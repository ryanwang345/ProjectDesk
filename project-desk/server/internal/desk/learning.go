package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/jackc/pgx/v5"
)

const learningXPPerCorrect = 10

type LearningDay struct {
	Day        string `json:"day"`
	Reading    int    `json:"reading"`
	Vocabulary int    `json:"vocabulary"`
	XP         int    `json:"xp"`
}

type LearningProgress struct {
	XP             int           `json:"xp"`
	Streak         int           `json:"streak"`
	LastDay        string        `json:"lastDay"`
	Completed      []int         `json:"completed"`
	Timezone       string        `json:"timezone"`
	Weekly         []LearningDay `json:"weekly"`
	LegacyImported bool          `json:"legacyImported"`
	AwardedXP      *int          `json:"awardedXP,omitempty"`
}

type legacyLearningProgress struct {
	XP        int    `json:"xp"`
	Streak    int    `json:"streak"`
	LastDay   string `json:"lastDay"`
	Completed []int  `json:"completed"`
}

func learningLocation(zone string) (*time.Location, error) {
	if zone == "" {
		zone = "UTC"
	}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return nil, fmt.Errorf("%w: choose a valid IANA timezone", ErrInvalid)
	}
	return location, nil
}

func (s *Store) ensureLearningProfile(ctx context.Context, zone string) error {
	location, err := learningLocation(zone)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `INSERT INTO learning_profile (id,timezone) VALUES ('workspace',$1) ON CONFLICT (id) DO NOTHING`, location.String())
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		// Prior reading attempts had no XP feature. Preserve their real activity,
		// without retrospectively inventing rewards.
		_, err = tx.Exec(ctx, `INSERT INTO learning_events (event_key,kind,xp,activity_day) SELECT 'reading:'||id::text,'reading',0,(submitted_at AT TIME ZONE $1)::date FROM reading_sessions WHERE status='submitted' AND submitted_at IS NOT NULL ON CONFLICT DO NOTHING`, location.String())
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func previousLearningDay(day string) string {
	date, err := time.Parse("2006-01-02", day)
	if err != nil {
		return ""
	}
	return date.AddDate(0, 0, -1).Format("2006-01-02")
}

func learningStreak(days map[string]bool, today, legacyDay string, legacyStreak int) int {
	active := func(day string) bool { return days[day] || (legacyStreak > 0 && day == legacyDay) }
	cursor := today
	if !active(cursor) {
		cursor = previousLearningDay(cursor)
	}
	streak := 0
	for active(cursor) {
		if cursor == legacyDay && legacyStreak > 0 {
			return streak + legacyStreak
		}
		streak++
		cursor = previousLearningDay(cursor)
	}
	return streak
}

func (s *Store) GetLearningProgress(ctx context.Context, zone string) (LearningProgress, error) {
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return LearningProgress{}, err
	}
	progress := LearningProgress{Completed: []int{}, Weekly: []LearningDay{}}
	var completed []byte
	var legacyDay string
	var legacyStreak int
	err := s.pool.QueryRow(ctx, `SELECT timezone,completed,legacy_imported,COALESCE(legacy_last_day::text,''),legacy_streak FROM learning_profile WHERE id='workspace'`).Scan(&progress.Timezone, &completed, &progress.LegacyImported, &legacyDay, &legacyStreak)
	if err != nil {
		return progress, err
	}
	if err := json.Unmarshal(completed, &progress.Completed); err != nil {
		return progress, err
	}
	location, _ := learningLocation(progress.Timezone)
	now := time.Now().In(location)
	today := now.Format("2006-01-02")
	rows, err := s.pool.Query(ctx, `SELECT COALESCE(activity_day::text,''),kind,count(*),COALESCE(sum(xp),0) FROM learning_events GROUP BY activity_day,kind ORDER BY activity_day DESC`)
	if err != nil {
		return progress, err
	}
	defer rows.Close()
	days := map[string]bool{}
	activity := map[string]*LearningDay{}
	for rows.Next() {
		var day, kind string
		var count, xp int
		if err := rows.Scan(&day, &kind, &count, &xp); err != nil {
			return progress, err
		}
		progress.XP += xp
		if day != "" && day <= today {
			days[day] = true
			if progress.LastDay == "" {
				progress.LastDay = day
			}
		}
		item := activity[day]
		if item == nil {
			item = &LearningDay{Day: day}
			activity[day] = item
		}
		if kind == "reading" {
			item.Reading += count
		} else {
			item.Vocabulary += count
		}
		item.XP += xp
	}
	if err := rows.Err(); err != nil {
		return progress, err
	}
	progress.Streak = learningStreak(days, today, legacyDay, legacyStreak)
	for offset := -6; offset <= 0; offset++ {
		day := now.AddDate(0, 0, offset).Format("2006-01-02")
		if item := activity[day]; item != nil {
			progress.Weekly = append(progress.Weekly, *item)
		} else {
			progress.Weekly = append(progress.Weekly, LearningDay{Day: day})
		}
	}
	return progress, nil
}

func (s *Store) ImportLearningProgress(ctx context.Context, in legacyLearningProgress, zone string) (LearningProgress, error) {
	if in.XP < 0 || in.XP > 100000000 || in.Streak < 0 || in.Streak > 10000 || len(in.Completed) > 10000 {
		return LearningProgress{}, fmt.Errorf("%w: invalid legacy progress", ErrInvalid)
	}
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return LearningProgress{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LearningProgress{}, err
	}
	defer tx.Rollback(ctx)
	var imported bool
	var profileZone string
	var existingRaw []byte
	if err := tx.QueryRow(ctx, `SELECT legacy_imported,timezone,completed FROM learning_profile WHERE id='workspace' FOR UPDATE`).Scan(&imported, &profileZone, &existingRaw); err != nil {
		return LearningProgress{}, err
	}
	if !imported && (in.XP > 0 || len(in.Completed) > 0) {
		location, _ := learningLocation(profileZone)
		day := in.LastDay
		if day != "" {
			parsed, err := time.Parse("2006-01-02", day)
			if err != nil || parsed.Format("2006-01-02") > time.Now().In(location).Format("2006-01-02") {
				return LearningProgress{}, fmt.Errorf("%w: invalid legacy activity date", ErrInvalid)
			}
		}
		completed := map[int]bool{}
		var existing []int
		if err := json.Unmarshal(existingRaw, &existing); err != nil {
			return LearningProgress{}, err
		}
		for _, n := range append(existing, in.Completed...) {
			if n < 0 {
				return LearningProgress{}, fmt.Errorf("%w: invalid completed lesson", ErrInvalid)
			}
			completed[n] = true
		}
		merged := []int{}
		for n := range completed {
			merged = append(merged, n)
		}
		sort.Ints(merged)
		raw, _ := json.Marshal(merged)
		if _, err := tx.Exec(ctx, `UPDATE learning_profile SET legacy_imported=true,completed=$1::jsonb,legacy_last_day=NULLIF($2,'')::date,legacy_streak=$3 WHERE id='workspace'`, raw, day, in.Streak); err != nil {
			return LearningProgress{}, err
		}
		// Missing historical dates are not invented. Undated XP has a NULL date.
		if _, err := tx.Exec(ctx, `INSERT INTO learning_events (event_key,kind,xp,activity_day) VALUES ('legacy:english','legacy',$1,NULLIF($2,'')::date) ON CONFLICT DO NOTHING`, in.XP, day); err != nil {
			return LearningProgress{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return LearningProgress{}, err
	}
	return s.GetLearningProgress(ctx, zone)
}

func recordReadingLearning(ctx context.Context, tx pgx.Tx, session ReadingSession, results ReadingSessionResults) error {
	var zone string
	if err := tx.QueryRow(ctx, `SELECT timezone FROM learning_profile WHERE id='workspace'`).Scan(&zone); err != nil {
		return err
	}
	location, _ := learningLocation(zone)
	day := time.Now().In(location).Format("2006-01-02")
	_, err := tx.Exec(ctx, `INSERT INTO learning_events (event_key,kind,xp,activity_day) VALUES ($1,'reading',$2,$3::date) ON CONFLICT DO NOTHING`, "reading:"+session.ID, results.Score*learningXPPerCorrect, day)
	return err
}

func (s *Store) CompleteVocabularyLesson(ctx context.Context, lesson, correct int, zone string) (LearningProgress, error) {
	if lesson < 0 || correct < 0 || correct > 10 {
		return LearningProgress{}, fmt.Errorf("%w: invalid lesson completion", ErrInvalid)
	}
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM english_cards`).Scan(&count); err != nil {
		return LearningProgress{}, err
	}
	if lesson >= (count+4)/5 {
		return LearningProgress{}, ErrNotFound
	}
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return LearningProgress{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LearningProgress{}, err
	}
	defer tx.Rollback(ctx)
	var raw []byte
	var profileZone string
	if err := tx.QueryRow(ctx, `SELECT completed,timezone FROM learning_profile WHERE id='workspace' FOR UPDATE`).Scan(&raw, &profileZone); err != nil {
		return LearningProgress{}, err
	}
	completed := []int{}
	if err := json.Unmarshal(raw, &completed); err != nil {
		return LearningProgress{}, err
	}
	already := false
	for _, n := range completed {
		already = already || n == lesson
	}
	location, _ := learningLocation(profileZone)
	if !already {
		completed = append(completed, lesson)
		sort.Ints(completed)
		raw, _ = json.Marshal(completed)
		if _, err := tx.Exec(ctx, `UPDATE learning_profile SET completed=$1::jsonb WHERE id='workspace'`, raw); err != nil {
			return LearningProgress{}, err
		}
	}
	day := time.Now().In(location).Format("2006-01-02")
	xp := 0
	if !already {
		xp = correct * learningXPPerCorrect
	}
	tag, err := tx.Exec(ctx, `INSERT INTO learning_events (event_key,kind,xp,activity_day) VALUES ($1,'vocabulary',$2,$3::date) ON CONFLICT DO NOTHING`, "vocabulary:lesson:"+strconv.Itoa(lesson)+":"+day, xp, day)
	if err != nil {
		return LearningProgress{}, err
	}
	if tag.RowsAffected() == 0 {
		xp = 0
	}
	if err := tx.Commit(ctx); err != nil {
		return LearningProgress{}, err
	}
	progress, err := s.GetLearningProgress(ctx, zone)
	progress.AwardedXP = &xp
	return progress, err
}

func validReadingModule(module string) (string, error) {
	module = strings.ToLower(strings.TrimSpace(module))
	if module == "" {
		return "academic", nil
	}
	if module != "academic" && module != "general" {
		return "", fmt.Errorf("%w: choose Academic or General Training", ErrInvalid)
	}
	return module, nil
}

func readingNotFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return ErrNotFound
	}
	return err
}
