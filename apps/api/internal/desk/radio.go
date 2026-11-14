package desk

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

type RadioVocabularyItem struct {
	Word           string `json:"word"`
	Pos            string `json:"pos"`
	IPA            string `json:"ipa"`
	Meaning        string `json:"meaning"`
	Band           string `json:"band"`
	ContextSnippet string `json:"contextSnippet"`
}

type RadioLiaison struct {
	Phrase string `json:"phrase"`
	IPA    string `json:"ipa"`
	NoteZh string `json:"noteZh"`
	Note   string `json:"note"`
}

type RadioLiveArticle struct {
	Title       string `json:"title"`
	TitleZh     string `json:"titleZh"`
	Summary     string `json:"summary"`
	SummaryZh   string `json:"summaryZh"`
	Link        string `json:"link"`
	Source      string `json:"source"`
	Category    string `json:"category"`
	PublishedAt string `json:"publishedAt"`
}

type RadioNewsWheelSegment struct {
	ID              string                `json:"id"`
	TimeMark        string                `json:"timeMark"`
	Title           string                `json:"title"`
	TitleZh         string                `json:"titleZh"`
	Anchor          string                `json:"anchor"`
	StartSecond     int                   `json:"startSecond"`
	EndSecond       int                   `json:"endSecond"`
	Text            string                `json:"text"`
	TextZh          string                `json:"textZh"`
	PublishedAt     string                `json:"publishedAt,omitempty"`
	SourceURL       string                `json:"sourceUrl,omitempty"`
	SourceName      string                `json:"sourceName,omitempty"`
	Liaisons        []RadioLiaison        `json:"liaisons"`
	KeyLexis        []RadioVocabularyItem `json:"keyLexis"`
	RelatedArticles []RadioLiveArticle    `json:"relatedArticles,omitempty"`
}

type RadioLiveWeather struct {
	TemperatureC  float64 `json:"temperatureC"`
	FeelsLikeC    float64 `json:"feelsLikeC"`
	WindSpeedKmh  float64 `json:"windSpeedKmh"`
	WindGustsKmh  float64 `json:"windGustsKmh"`
	WindDirection string  `json:"windDirection"`
	Condition     string  `json:"condition"`
	ConditionZh   string  `json:"conditionZh"`
	ObservedAt    string  `json:"observedAt"`
}

type RadioBulletin struct {
	UpdatedAt    string                  `json:"updatedAt"`
	Source       string                  `json:"source"`
	IsLive       bool                    `json:"isLive"`
	Weather      *RadioLiveWeather       `json:"weather,omitempty"`
	Segments     []RadioNewsWheelSegment `json:"segments"`
	LiveArticles []RadioLiveArticle      `json:"liveArticles"`
}

type radioNewsService struct {
	mu        sync.Mutex
	cached    *RadioBulletin
	expiresAt time.Time
	client    *http.Client
	lexicon   map[string]RadioVocabularyItem
	lexOnce   sync.Once
}

func newRadioNewsService() *radioNewsService {
	return &radioNewsService{
		client: &http.Client{Timeout: 6 * time.Second},
	}
}

func (h *Handler) registerRadio(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/radio/news", h.getRadioNews)
	mux.HandleFunc("POST /api/radio/news/refresh", h.refreshRadioNews)
}

func (h *Handler) getRadioNews(w http.ResponseWriter, r *http.Request) {
	force := r.URL.Query().Get("refresh") == "1" || r.URL.Query().Get("refresh") == "true"
	bulletin := h.radio.GetBulletin(r.Context(), force)
	writeJSON(w, http.StatusOK, bulletin)
}

func (h *Handler) refreshRadioNews(w http.ResponseWriter, r *http.Request) {
	bulletin := h.radio.GetBulletin(r.Context(), true)
	writeJSON(w, http.StatusOK, bulletin)
}

func (s *radioNewsService) GetBulletin(ctx context.Context, force bool) RadioBulletin {
	s.mu.Lock()
	if !force && s.cached != nil && time.Now().Before(s.expiresAt) {
		out := *s.cached
		s.mu.Unlock()
		return out
	}
	s.mu.Unlock()

	bulletin := s.buildLiveBulletin(ctx)

	s.mu.Lock()
	s.cached = &bulletin
	if bulletin.IsLive {
		s.expiresAt = time.Now().Add(5 * time.Minute)
	} else {
		s.expiresAt = time.Now().Add(1 * time.Minute)
	}
	s.mu.Unlock()

	return bulletin
}

type rssFeed struct {
	Channel struct {
		Title string    `xml:"title"`
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title       string   `xml:"title"`
	Link        string   `xml:"link"`
	Description string   `xml:"description"`
	Content     string   `xml:"encoded"`
	PubDate     string   `xml:"pubDate"`
	Categories  []string `xml:"category"`
}

type feedSpec struct {
	url            string
	source         string
	defaultSlot    string
}

var liveFeedSpecs = []feedSpec{
	{
		url:         "https://toronto.citynews.ca/feed/",
		source:      "CityNews 680 Toronto",
		defaultSlot: "Top Headlines",
	},
	{
		url:         "https://www.cbc.ca/webfeed/rss/rss-canada-toronto",
		source:      "CBC Toronto",
		defaultSlot: "Top Headlines",
	},
	{
		url:         "https://globalnews.ca/toronto/feed/",
		source:      "Global News Toronto",
		defaultSlot: "Top Headlines",
	},
	{
		url:         "https://www.cbc.ca/webfeed/rss/rss-business",
		source:      "CBC Business",
		defaultSlot: "Business News",
	},
	{
		url:         "https://www.cbc.ca/webfeed/rss/rss-sports",
		source:      "CBC Sports",
		defaultSlot: "Sports & Culture",
	},
}

func (s *radioNewsService) buildLiveBulletin(ctx context.Context) RadioBulletin {
	fetchCtx, cancel := context.WithTimeout(ctx, 7*time.Second)
	defer cancel()

	var (
		weather     *RadioLiveWeather
		feedResults = make([][]RadioLiveArticle, len(liveFeedSpecs))
		wg          sync.WaitGroup
	)

	wg.Add(1)
	go func() {
		defer wg.Done()
		weather = s.fetchTorontoWeather(fetchCtx)
	}()

	for idx, spec := range liveFeedSpecs {
		wg.Add(1)
		go func(i int, sp feedSpec) {
			defer wg.Done()
			feedResults[i] = s.fetchRSSArticles(fetchCtx, sp)
		}(idx, spec)
	}

	wg.Wait()

	var allArticles []RadioLiveArticle
	seenTitles := map[string]bool{}
	for _, list := range feedResults {
		for _, a := range list {
			key := strings.ToLower(strings.TrimSpace(a.Title))
			if key == "" || seenTitles[key] {
				continue
			}
			seenTitles[key] = true
			allArticles = append(allArticles, a)
		}
	}

	fallbackSegments := defaultRadioSegments()
	isLive := len(allArticles) > 0 || weather != nil

	bySlot := map[string][]RadioLiveArticle{
		"Traffic & Weather": {},
		"Top Headlines":     {},
		"Business News":     {},
		"Sports & Culture":  {},
	}

	for _, art := range allArticles {
		slot := classifyRadioArticle(art)
		bySlot[slot] = append(bySlot[slot], art)
	}

	// Ensure Top Headlines and other buckets have stories if available from general pool
	for _, slot := range []string{"Top Headlines", "Traffic & Weather", "Business News", "Sports & Culture"} {
		if len(bySlot[slot]) == 0 && len(allArticles) > 0 {
			for _, art := range allArticles {
				if len(bySlot[slot]) >= 2 {
					break
				}
				bySlot[slot] = append(bySlot[slot], art)
			}
		}
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	segments := make([]RadioNewsWheelSegment, 4)

	// 1. Traffic & Weather
	segments[0] = s.composeTrafficWeatherSegment(weather, bySlot["Traffic & Weather"], fallbackSegments[0], nowStr)
	// 2. Top Headlines
	segments[1] = s.composeSlotSegment(
		"seg-680-metro-bulletin",
		"Top Headlines",
		"Richard Southern & Carl Hanstke",
		80, 175,
		"From the 680 Newsroom, checking top breaking stories across the Greater Toronto Area.",
		bySlot["Top Headlines"],
		fallbackSegments[1],
		nowStr,
	)
	// 3. Business News
	segments[2] = s.composeSlotSegment(
		"seg-680-business-pulse",
		"Business News",
		"Mike Eppel (Senior Business Editor)",
		175, 265,
		"In 680 Business, tracking the latest market and economic developments.",
		bySlot["Business News"],
		fallbackSegments[2],
		nowStr,
	)
	// 4. Sports & Culture
	segments[3] = s.composeSlotSegment(
		"seg-680-lifestyle-weather",
		"Sports & Culture",
		"Jill Taylor & Newsroom Team",
		265, 360,
		"In 680 Sports and Metro Culture, here is what is happening around Toronto and across the leagues.",
		bySlot["Sports & Culture"],
		fallbackSegments[3],
		nowStr,
	)

	// Translate live titles and texts concurrently for crisp bilingual display
	transCtx, transCancel := context.WithTimeout(ctx, 5*time.Second)
	defer transCancel()
	s.populateTranslations(transCtx, segments, allArticles)

	// Sync translated TitleZh/SummaryZh back into each segment's RelatedArticles
	translatedByKey := make(map[string]RadioLiveArticle, len(allArticles))
	for _, art := range allArticles {
		translatedByKey[strings.ToLower(strings.TrimSpace(art.Title))] = art
	}
	for i := range segments {
		for j := range segments[i].RelatedArticles {
			key := strings.ToLower(strings.TrimSpace(segments[i].RelatedArticles[j].Title))
			if tr, ok := translatedByKey[key]; ok {
				segments[i].RelatedArticles[j].TitleZh = tr.TitleZh
				segments[i].RelatedArticles[j].SummaryZh = tr.SummaryZh
			}
		}
	}

	return RadioBulletin{
		UpdatedAt:    nowStr,
		Source:       "CityNews 680 Toronto / CBC / Open-Meteo Live",
		IsLive:       isLive,
		Weather:      weather,
		Segments:     segments,
		LiveArticles: allArticles,
	}
}

func (s *radioNewsService) composeTrafficWeatherSegment(
	weather *RadioLiveWeather,
	trafficArticles []RadioLiveArticle,
	fallback RadioNewsWheelSegment,
	nowStr string,
) RadioNewsWheelSegment {
	if weather == nil && len(trafficArticles) == 0 {
		return fallback
	}

	var parts []string
	parts = append(parts, "This is 680 News. Time for traffic and weather together on the 1s.")

	title := fallback.Title
	titleZh := fallback.TitleZh
	sourceURL := "https://toronto.citynews.ca/traffic/"
	sourceName := "CityNews 680 Traffic & Weather"
	publishedAt := nowStr

	if weather != nil {
		temp := fmt.Sprintf("%.0f", weather.TemperatureC)
		feels := fmt.Sprintf("%.0f", weather.FeelsLikeC)
		wind := fmt.Sprintf("%.0f", weather.WindSpeedKmh)
		gust := fmt.Sprintf("%.0f", weather.WindGustsKmh)

		weatherLine := fmt.Sprintf(
			"Over at Toronto Pearson International Airport and downtown Toronto, current conditions are %s at %s degrees Celsius, feeling like %s, with %s winds at %s kilometers an hour and gusts up to %s.",
			strings.ToLower(weather.Condition),
			temp,
			feels,
			strings.ToLower(weather.WindDirection),
			wind,
			gust,
		)
		parts = append(parts, weatherLine)
		title = fmt.Sprintf("680 News Live Weather & Traffic: %s°C %s in Toronto", temp, weather.Condition)
		titleZh = fmt.Sprintf("680 实时路况与气象：多伦多当前 %s°C %s（体感 %s°C，阵风 %s km/h）", temp, weather.ConditionZh, feels, gust)
	}

	if len(trafficArticles) > 0 {
		top := trafficArticles[0]
		if top.Link != "" {
			sourceURL = top.Link
		}
		if top.Source != "" {
			sourceName = top.Source
		}
		if top.PublishedAt != "" {
			publishedAt = top.PublishedAt
		}
		if weather != nil {
			title = fmt.Sprintf("680 Live (%0.f°C %s): %s", weather.TemperatureC, weather.Condition, top.Title)
		} else {
			title = "680 News Live Traffic & Weather: " + top.Title
		}
		for i, art := range trafficArticles {
			if i >= 2 {
				break
			}
			line := cleanBroadcastSentence(art.Title, art.Summary)
			if line != "" {
				parts = append(parts, line)
			}
		}
	} else {
		parts = append(parts, "In the 680 News airborne traffic centre, major commuter corridors across the Gardiner Expressway, the Don Valley Parkway, and Highway 401 are being monitored closely for rush-hour volume and arterial slowdowns.")
	}

	text := strings.Join(parts, " ")
	related := trafficArticles

	return RadioNewsWheelSegment{
		ID:              fallback.ID,
		TimeMark:        fallback.TimeMark,
		Title:           title,
		TitleZh:         titleZh,
		Anchor:          fallback.Anchor,
		StartSecond:     fallback.StartSecond,
		EndSecond:       fallback.EndSecond,
		Text:            text,
		TextZh:          "", // filled by populateTranslations
		PublishedAt:     publishedAt,
		SourceURL:       sourceURL,
		SourceName:      sourceName,
		Liaisons:        extractRadioLiaisons(text, fallback.Liaisons),
		KeyLexis:        s.extractRadioLexis(text, fallback.KeyLexis),
		RelatedArticles: related,
	}
}

func (s *radioNewsService) composeSlotSegment(
	id, timeMark, anchor string,
	startSec, endSec int,
	leadIn string,
	articles []RadioLiveArticle,
	fallback RadioNewsWheelSegment,
	nowStr string,
) RadioNewsWheelSegment {
	if len(articles) == 0 {
		return fallback
	}

	top := articles[0]
	var parts []string
	parts = append(parts, leadIn)

	for i, art := range articles {
		if i >= 3 {
			break
		}
		line := cleanBroadcastSentence(art.Title, art.Summary)
		if line != "" {
			parts = append(parts, line)
		}
	}

	parts = append(parts, "Stay tuned to 680 NewsRadio Toronto for continuous live coverage.")
	text := strings.Join(parts, " ")

	related := articles

	pub := top.PublishedAt
	if pub == "" {
		pub = nowStr
	}

	return RadioNewsWheelSegment{
		ID:              id,
		TimeMark:        timeMark,
		Title:           top.Title,
		TitleZh:         "", // filled by populateTranslations
		Anchor:          anchor,
		StartSecond:     startSec,
		EndSecond:       endSec,
		Text:            text,
		TextZh:          "", // filled by populateTranslations
		PublishedAt:     pub,
		SourceURL:       top.Link,
		SourceName:      top.Source,
		Liaisons:        extractRadioLiaisons(text, fallback.Liaisons),
		KeyLexis:        s.extractRadioLexis(text, fallback.KeyLexis),
		RelatedArticles: related,
	}
}

func (s *radioNewsService) fetchTorontoWeather(ctx context.Context) *RadioLiveWeather {
	endpoint := "https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&timezone=America%2FToronto"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "ProjectDesk-680NewsRadio/1.0")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var payload struct {
		Current struct {
			Time                string  `json:"time"`
			Temperature2m       float64 `json:"temperature_2m"`
			ApparentTemperature float64 `json:"apparent_temperature"`
			WeatherCode         int     `json:"weather_code"`
			WindSpeed10m        float64 `json:"wind_speed_10m"`
			WindGusts10m        float64 `json:"wind_gusts_10m"`
			WindDirection10m    float64 `json:"wind_direction_10m"`
		} `json:"current"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil
	}

	condEn, condZh := describeWeatherCode(payload.Current.WeatherCode)
	return &RadioLiveWeather{
		TemperatureC:  payload.Current.Temperature2m,
		FeelsLikeC:    payload.Current.ApparentTemperature,
		WindSpeedKmh:  payload.Current.WindSpeed10m,
		WindGustsKmh:  payload.Current.WindGusts10m,
		WindDirection: cardinalDirection(payload.Current.WindDirection10m),
		Condition:     condEn,
		ConditionZh:   condZh,
		ObservedAt:    payload.Current.Time,
	}
}

func (s *radioNewsService) fetchRSSArticles(ctx context.Context, spec feedSpec) []RadioLiveArticle {
	urls := []string{
		spec.url,
		"https://api.allorigins.win/raw?url=" + url.QueryEscape(spec.url),
	}
	for _, targetURL := range urls {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, text/html, */*;q=0.9")
		req.Header.Set("Accept-Language", "en-CA,en-US;q=0.9,en;q=0.8")

		resp, err := s.client.Do(req)
		if err != nil {
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}

		body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		resp.Body.Close()
		if err != nil {
			continue
		}

		if items := parseRSSItems(body, spec); len(items) > 0 {
			return items
		}
	}
	return nil
}

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)
var multiSpaceRe = regexp.MustCompile(`\s+`)
var cityNewsFooterRe = regexp.MustCompile(`(?i)The post .*? appeared first on CityNews.*$`)

func parseRSSItems(xmlBytes []byte, spec feedSpec) []RadioLiveArticle {
	var feed rssFeed
	if err := xml.Unmarshal(xmlBytes, &feed); err != nil {
		return nil
	}

	var out []RadioLiveArticle
	for _, item := range feed.Channel.Items {
		title := cleanPlainText(item.Title)
		if title == "" {
			continue
		}
		summary := cleanPlainText(item.Description)
		summary = cityNewsFooterRe.ReplaceAllString(summary, "")
		summary = strings.TrimSpace(summary)
		if item.Content != "" {
			full := cleanPlainText(item.Content)
			full = cityNewsFooterRe.ReplaceAllString(full, "")
			full = strings.TrimSpace(full)
			if len(full) > len(summary) {
				summary = full
			}
		}
		if len(summary) > 900 {
			summary = truncateSentence(summary, 900)
		}

		cat := spec.defaultSlot
		for _, c := range item.Categories {
			lc := strings.ToLower(c)
			switch {
			case strings.Contains(lc, "traffic") || strings.Contains(lc, "weather") || strings.Contains(lc, "transit"):
				cat = "Traffic & Weather"
			case strings.Contains(lc, "business") || strings.Contains(lc, "economy") || strings.Contains(lc, "money") || strings.Contains(lc, "market"):
				cat = "Business News"
			case strings.Contains(lc, "sport") || strings.Contains(lc, "entertainment") || strings.Contains(lc, "lifestyle") || strings.Contains(lc, "culture"):
				cat = "Sports & Culture"
			}
		}

		art := RadioLiveArticle{
			Title:       title,
			Summary:     summary,
			Link:        strings.TrimSpace(item.Link),
			Source:      spec.source,
			Category:    cat,
			PublishedAt: normalizePubDate(item.PubDate),
		}
		art.Category = classifyRadioArticle(art)
		out = append(out, art)
		if len(out) >= 100 {
			break
		}
	}
	return out
}

func classifyRadioArticle(a RadioLiveArticle) string {
	combined := strings.ToLower(a.Title + " " + a.Summary + " " + a.Category)
	switch {
	case containsAnyKeyword(combined,
		"traffic", "weather", "highway", "401", "gardiner", "dvp", "don valley",
		"ttc", "subway", "go transit", "metrolinx", "eglinton", "commute",
		"lane", "closure", "collision", "crash", "snow", "rain", "storm", "wind",
		"temperature", "forecast", "environment canada", "pearson airport",
	):
		return "Traffic & Weather"
	case containsAnyKeyword(combined,
		"tsx", "bank of canada", "interest rate", "inflation", "economy", "economic",
		"market", "stock", "dollar", "tariff", "trade", "business", "housing market",
		"mortgage", "retail", "jobs", "unemployment", "gdp", "investing", "earnings",
	):
		return "Business News"
	case containsAnyKeyword(combined,
		"maple leafs", "blue jays", "raptors", "argonauts", "tfc", "nhl", "nba", "mlb",
		"hockey", "baseball", "basketball", "soccer", "playoff", "tournament", "concert",
		"festival", "tiff", "art", "museum", "culture", "weekend", "harbourfront", "athlete",
	):
		return "Sports & Culture"
	}
	if a.Category != "" {
		return a.Category
	}
	return "Top Headlines"
}

func containsAnyKeyword(haystack string, keywords ...string) bool {
	for _, kw := range keywords {
		if strings.Contains(haystack, kw) {
			return true
		}
	}
	return false
}

func cleanPlainText(raw string) string {
	s := html.UnescapeString(raw)
	s = htmlTagRe.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	s = strings.ReplaceAll(s, "\u00a0", " ")
	s = strings.ReplaceAll(s, "[…]", "...")
	s = strings.ReplaceAll(s, "[&#8230;]", "...")
	s = multiSpaceRe.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func truncateSentence(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	cut := s[:maxLen]
	if idx := strings.LastIndexAny(cut, ".!?"); idx > maxLen/2 {
		return strings.TrimSpace(cut[:idx+1])
	}
	if idx := strings.LastIndex(cut, " "); idx > 0 {
		return strings.TrimSpace(cut[:idx]) + "..."
	}
	return cut + "..."
}

func cleanBroadcastSentence(title, summary string) string {
	title = strings.TrimSpace(title)
	summary = strings.TrimSpace(summary)
	if title == "" && summary == "" {
		return ""
	}
	if title != "" && !strings.HasSuffix(title, ".") && !strings.HasSuffix(title, "!") && !strings.HasSuffix(title, "?") {
		title += "."
	}
	if summary == "" || strings.EqualFold(title, summary) {
		return title
	}
	if !strings.HasSuffix(summary, ".") && !strings.HasSuffix(summary, "!") && !strings.HasSuffix(summary, "?") {
		summary += "."
	}
	return title + " " + summary
}

func normalizePubDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	layouts := []string{
		time.RFC1123Z,
		time.RFC1123,
		time.RFC822Z,
		time.RFC822,
		time.RFC3339,
		"Mon, 2 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 MST",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
	}
	return raw
}

func describeWeatherCode(code int) (string, string) {
	switch {
	case code == 0:
		return "Clear skies", "晴朗无云"
	case code == 1:
		return "Mainly clear", "晴间少云"
	case code == 2:
		return "Partly cloudy", "多云间晴"
	case code == 3:
		return "Overcast", "阴天多云"
	case code == 45 || code == 48:
		return "Foggy conditions", "有雾"
	case code >= 51 && code <= 57:
		return "Light drizzle", "零星毛毛雨"
	case code >= 61 && code <= 67:
		return "Rain showers", "降雨天气"
	case code >= 71 && code <= 77:
		return "Snowfall", "降雪天气"
	case code >= 80 && code <= 82:
		return "Scattered rain showers", "阵雨天气"
	case code >= 85 && code <= 86:
		return "Snow showers", "阵雪天气"
	case code >= 95:
		return "Thunderstorms", "雷暴天气"
	default:
		return "Variable cloudiness", "多云天气"
	}
}

func cardinalDirection(deg float64) string {
	dirs := []string{"northerly", "northeasterly", "easterly", "southeasterly", "southerly", "southwesterly", "westerly", "northwesterly"}
	idx := int((deg+22.5)/45.0) % 8
	if idx < 0 {
		idx = 0
	}
	return dirs[idx]
}

func (s *radioNewsService) populateTranslations(ctx context.Context, segments []RadioNewsWheelSegment, allArticles []RadioLiveArticle) {
	var wg sync.WaitGroup
	for i := range segments {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			seg := &segments[idx]
			if seg.TitleZh == "" {
				if zh := s.translateToZh(ctx, seg.Title); zh != "" {
					seg.TitleZh = zh
				} else {
					seg.TitleZh = "680 News 实时快讯：" + seg.Title
				}
			}
			if seg.TextZh == "" {
				if zh := s.translateToZh(ctx, seg.Text); zh != "" {
					seg.TextZh = zh
				} else {
					seg.TextZh = "【680 News 实时播报】" + seg.TitleZh
				}
			}
		}(i)
	}

	// Translate all articles in batches of 10 using newline delimiter
	const batchSize = 10
	for start := 0; start < len(allArticles); start += batchSize {
		end := start + batchSize
		if end > len(allArticles) {
			end = len(allArticles)
		}
		wg.Add(1)
		go func(st, en int) {
			defer wg.Done()
			var titles []string
			var summaries []string
			for k := st; k < en; k++ {
				titles = append(titles, strings.ReplaceAll(allArticles[k].Title, "\n", " "))
				summaries = append(summaries, strings.ReplaceAll(allArticles[k].Summary, "\n", " "))
			}
			if zhTitles := s.translateToZh(ctx, strings.Join(titles, "\n")); zhTitles != "" {
				lines := strings.Split(zhTitles, "\n")
				for offset, line := range lines {
					if st+offset < en {
						allArticles[st+offset].TitleZh = strings.TrimSpace(line)
					}
				}
			}
			if zhSummaries := s.translateToZh(ctx, strings.Join(summaries, "\n")); zhSummaries != "" {
				lines := strings.Split(zhSummaries, "\n")
				for offset, line := range lines {
					if st+offset < en {
						allArticles[st+offset].SummaryZh = strings.TrimSpace(line)
					}
				}
			}
		}(start, end)
	}

	wg.Wait()

	// Sync translated TitleZh & SummaryZh back into each segment's RelatedArticles
	byLink := make(map[string]RadioLiveArticle, len(allArticles))
	for _, a := range allArticles {
		byLink[a.Link+"|"+a.Title] = a
	}
	for i := range segments {
		for j := range segments[i].RelatedArticles {
			rel := &segments[i].RelatedArticles[j]
			if updated, ok := byLink[rel.Link+"|"+rel.Title]; ok {
				rel.TitleZh = updated.TitleZh
				rel.SummaryZh = updated.SummaryZh
			}
		}
	}
}

func (s *radioNewsService) translateToZh(ctx context.Context, text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	endpoint := "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=" + url.QueryEscape(text)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := s.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	var raw []any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil || len(raw) == 0 {
		return ""
	}
	sentences, ok := raw[0].([]any)
	if !ok {
		return ""
	}
	var sb strings.Builder
	for _, item := range sentences {
		pair, ok := item.([]any)
		if !ok || len(pair) == 0 {
			continue
		}
		if part, ok := pair[0].(string); ok {
			sb.WriteString(part)
		}
	}
	return strings.TrimSpace(sb.String())
}

var wordTokenRe = regexp.MustCompile(`[A-Za-z]{4,}`)

func (s *radioNewsService) initLexicon() {
	s.lexOnce.Do(func() {
		lex := make(map[string]RadioVocabularyItem, 2500)

		// Load built-in IELTS entries & extra vocab
		for _, e := range ieltsEntries {
			w := strings.ToLower(strings.TrimSpace(e.Word))
			if w == "" {
				continue
			}
			ipa := builtinPronunciations[w]
			if ipa == "" {
				ipa = "/" + w + "/"
			}
			lex[w] = RadioVocabularyItem{
				Word:    e.Word,
				Pos:     e.Kind + ".",
				IPA:     ipa,
				Meaning: e.Meaning,
				Band:    "Band 7.0",
			}
		}
		if extras, err := extraVocab(); err == nil {
			for _, e := range extras {
				w := strings.ToLower(strings.TrimSpace(e.Word))
				if w == "" {
					continue
				}
				if _, exists := lex[w]; exists {
					continue
				}
				ipa := builtinPronunciations[w]
				if ipa == "" {
					ipa = "/" + w + "/"
				}
				lex[w] = RadioVocabularyItem{
					Word:    e.Word,
					Pos:     e.Kind + ".",
					IPA:     ipa,
					Meaning: e.Meaning,
					Band:    "Band 6.5",
				}
			}
		}

		// Override with curated broadcast journalism vocabulary with exact IPA & Band
		for _, item := range curatedBroadcastLexis {
			lex[strings.ToLower(item.Word)] = item
		}
		s.lexicon = lex
	})
}

func (s *radioNewsService) extractRadioLexis(text string, fallback []RadioVocabularyItem) []RadioVocabularyItem {
	s.initLexicon()

	sentences := splitSentences(text)
	tokens := wordTokenRe.FindAllString(text, -1)

	var matched []RadioVocabularyItem
	seen := map[string]bool{}

	for _, tok := range tokens {
		low := strings.ToLower(tok)
		if stopWords[low] {
			continue
		}
		candidates := stemCandidates(low)
		for _, cand := range candidates {
			if seen[cand] {
				break
			}
			if item, ok := s.lexicon[cand]; ok {
				seen[cand] = true
				entry := item
				entry.ContextSnippet = findSentenceContaining(sentences, tok, text)
				matched = append(matched, entry)
				break
			}
		}
		if len(matched) >= 5 {
			break
		}
	}

	// Fill up to 4 items from fallback if live text had fewer matches
	for _, fb := range fallback {
		if len(matched) >= 4 {
			break
		}
		key := strings.ToLower(fb.Word)
		if !seen[key] {
			seen[key] = true
			matched = append(matched, fb)
		}
	}
	return matched
}

func stemCandidates(w string) []string {
	out := []string{w}
	if strings.HasSuffix(w, "ies") && len(w) > 5 {
		out = append(out, w[:len(w)-3]+"y")
	}
	if strings.HasSuffix(w, "es") && len(w) > 4 {
		out = append(out, w[:len(w)-2], w[:len(w)-1])
	} else if strings.HasSuffix(w, "s") && len(w) > 4 {
		out = append(out, w[:len(w)-1])
	}
	if strings.HasSuffix(w, "ing") && len(w) > 5 {
		base := w[:len(w)-3]
		out = append(out, base, base+"e")
	}
	if strings.HasSuffix(w, "ed") && len(w) > 4 {
		base := w[:len(w)-2]
		out = append(out, base, base+"e")
	}
	if strings.HasSuffix(w, "ly") && len(w) > 5 {
		out = append(out, w[:len(w)-2])
	}
	return out
}

func splitSentences(text string) []string {
	var out []string
	start := 0
	for i := 0; i < len(text); i++ {
		if text[i] == '.' || text[i] == '!' || text[i] == '?' {
			if i+1 == len(text) || text[i+1] == ' ' {
				seg := strings.TrimSpace(text[start : i+1])
				if len(seg) > 15 {
					out = append(out, seg)
				}
				start = i + 1
			}
		}
	}
	if start < len(text) {
		if tail := strings.TrimSpace(text[start:]); len(tail) > 15 {
			out = append(out, tail)
		}
	}
	return out
}

func findSentenceContaining(sentences []string, token string, fallbackText string) string {
	lowTok := strings.ToLower(token)
	for _, s := range sentences {
		if strings.Contains(strings.ToLower(s), lowTok) {
			if len(s) > 160 {
				return truncateSentence(s, 160)
			}
			return s
		}
	}
	return truncateSentence(fallbackText, 140)
}

var liaisonPatterns = []struct {
	re     *regexp.Regexp
	build  func(match string) RadioLiaison
}{
	{
		re: regexp.MustCompile(`(?i)\b([a-z]+ing)\s+(a|an|in|on|at|up|out|over|across)\b`),
		build: func(m string) RadioLiaison {
			return RadioLiaison{
				Phrase: m,
				IPA:    "/..." + "ɪŋ‿" + strings.ToLower(strings.Fields(m)[1]) + "/",
				NoteZh: fmt.Sprintf("连读：-ing 鼻音与后面的元音功能词 “%s” 自然连读", strings.Fields(m)[1]),
				Note:   fmt.Sprintf("Linking: “-ing” flows directly into vowel-initial “%s”", strings.Fields(m)[1]),
			}
		},
	},
	{
		re: regexp.MustCompile(`(?i)\b([a-z]+ed)\s+to\b`),
		build: func(m string) RadioLiaison {
			return RadioLiaison{
				Phrase: m,
				IPA:    "/" + strings.ToLower(strings.Fields(m)[0]) + "‿tə/",
				NoteZh: "弱读与省音：过去式词尾 -ed 轻化，与弱读的 to (/tə/) 同化衔接",
				Note:   "Assimilation & reduction: final -ed blends into reduced “to” (/tə/)",
			}
		},
	},
	{
		re: regexp.MustCompile(`(?i)\b(in|on|at|of|for|from|with|across)\s+(a|an|the)\b`),
		build: func(m string) RadioLiaison {
			parts := strings.Fields(m)
			return RadioLiaison{
				Phrase: m,
				IPA:    "/" + strings.ToLower(parts[0]) + "‿ðə/",
				NoteZh: fmt.Sprintf("功能词弱读：“%s” 在新闻快语速中弱读并连成一个节奏群", m),
				Note:   fmt.Sprintf("Function word reduction: “%s” is unstressed as one rhythm unit", m),
			}
		},
	},
}

func extractRadioLiaisons(text string, fallback []RadioLiaison) []RadioLiaison {
	var out []RadioLiaison
	seen := map[string]bool{}

	for _, pat := range liaisonPatterns {
		matches := pat.re.FindAllString(text, 2)
		for _, m := range matches {
			key := strings.ToLower(m)
			if seen[key] {
				continue
			}
			seen[key] = true
			out = append(out, pat.build(m))
			if len(out) >= 2 {
				return out
			}
		}
	}

	for _, fb := range fallback {
		if len(out) >= 2 {
			break
		}
		out = append(out, fb)
	}
	return out
}

var stopWords = map[string]bool{
	"this": true, "that": true, "with": true, "from": true, "have": true, "will": true,
	"your": true, "here": true, "more": true, "when": true, "what": true, "were": true,
	"been": true, "they": true, "their": true, "there": true, "about": true, "after": true,
	"before": true, "under": true, "over": true, "into": true, "also": true, "some": true,
	"such": true, "than": true, "then": true, "them": true, "these": true, "those": true,
	"news": true, "time": true, "toronto": true, "canada": true, "canadian": true, "ontario": true,
	"city": true, "stay": true, "tuned": true, "live": true, "latest": true, "checking": true,
	"stories": true, "greater": true, "area": true, "degree": true, "degrees": true, "celsius": true,
	"hour": true, "hours": true, "kilometer": true, "kilometers": true, "newsroom": true,
}

var curatedBroadcastLexis = []RadioVocabularyItem{
	{Word: "commute", Pos: "n./v.", IPA: "/kəˈmjuːt/", Meaning: "通勤，上下班路程；往返上下班", Band: "Band 6.5"},
	{Word: "sluggish", Pos: "adj.", IPA: "/ˈslʌɡ.ɪʃ/", Meaning: "缓慢的，迟缓的；经济萧条的", Band: "Band 7.0"},
	{Word: "precipitation", Pos: "n.", IPA: "/prɪˌsɪp.ɪˈteɪ.ʃən/", Meaning: "降水（雨、雪等），降水量", Band: "Band 7.5"},
	{Word: "clog", Pos: "v./n.", IPA: "/klɒɡ/", Meaning: "堵塞，阻塞，使停滞", Band: "Band 6.5"},
	{Word: "arterial", Pos: "adj.", IPA: "/ɑːˈtɪə.ri.əl/", Meaning: "主干道的，干线的；动脉的", Band: "Band 7.5"},
	{Word: "corridor", Pos: "n.", IPA: "/ˈkɒr.ɪ.dɔːr/", Meaning: "交通走廊，通道；走廊", Band: "Band 6.5"},
	{Word: "expedite", Pos: "v.", IPA: "/ˈek.spə.daɪt/", Meaning: "加速，加快处理", Band: "Band 7.5"},
	{Word: "municipal", Pos: "adj.", IPA: "/mjuːˈnɪs.ɪ.pəl/", Meaning: "市政的，地方政府的", Band: "Band 7.0"},
	{Word: "bylaw", Pos: "n.", IPA: "/ˈbaɪ.lɔː/", Meaning: "地方法规，城市管理附例", Band: "Band 7.0"},
	{Word: "revitalize", Pos: "v.", IPA: "/riːˈvaɪ.təl.aɪz/", Meaning: "使复兴，赋予新生，活化", Band: "Band 7.5"},
	{Word: "benchmark", Pos: "n./adj.", IPA: "/ˈbentʃ.mɑːk/", Meaning: "基准，标杆；基准的", Band: "Band 7.0"},
	{Word: "buoy", Pos: "v.", IPA: "/bɔɪ/", Meaning: "提振，支撑，使浮起", Band: "Band 8.0"},
	{Word: "equity", Pos: "n.", IPA: "/ˈek.wɪ.ti/", Meaning: "股票，股权；公平，公正", Band: "Band 7.0"},
	{Word: "inflation", Pos: "n.", IPA: "/ɪnˈfleɪ.ʃən/", Meaning: "通货膨胀，物价上涨", Band: "Band 6.5"},
	{Word: "forecast", Pos: "n./v.", IPA: "/ˈfɔː.kɑːst/", Meaning: "天气预报，预测，展望", Band: "Band 6.0"},
	{Word: "artisan", Pos: "n./adj.", IPA: "/ˌɑː.tɪˈzæn/", Meaning: "手工艺人，工匠；手作的", Band: "Band 7.5"},
	{Word: "uninterrupted", Pos: "adj.", IPA: "/ˌʌn.ɪn.təˈrʌp.tɪd/", Meaning: "不间断的，连续的", Band: "Band 7.0"},
	{Word: "collision", Pos: "n.", IPA: "/kəˈlɪʒ.ən/", Meaning: "碰撞，交通事故；冲突", Band: "Band 6.5"},
	{Word: "investigation", Pos: "n.", IPA: "/ɪnˌves.tɪˈɡeɪ.ʃən/", Meaning: "调查，侦查，科学研究", Band: "Band 6.0"},
	{Word: "legislation", Pos: "n.", IPA: "/ˌledʒ.ɪsˈleɪ.ʃən/", Meaning: "立法，法规，法律条文", Band: "Band 7.0"},
	{Word: "provincial", Pos: "adj.", IPA: "/prəˈvɪn.ʃəl/", Meaning: "省级的，地方的", Band: "Band 6.5"},
	{Word: "federal", Pos: "adj.", IPA: "/ˈfed.ər.əl/", Meaning: "联邦的，联邦政府的", Band: "Band 6.5"},
	{Word: "tariff", Pos: "n.", IPA: "/ˈtær.ɪf/", Meaning: "关税，税率表；收费表", Band: "Band 7.0"},
	{Word: "transit", Pos: "n./v.", IPA: "/ˈtræn.zɪt/", Meaning: "公共交通，运输，通行", Band: "Band 6.5"},
	{Word: "infrastructure", Pos: "n.", IPA: "/ˈɪn.frəˌstrʌk.tʃər/", Meaning: "基础设施，公共建设", Band: "Band 7.0"},
	{Word: "authority", Pos: "n.", IPA: "/ɔːˈθɒr.ə.ti/", Meaning: "当局，官方机构；权威", Band: "Band 6.5"},
	{Word: "announcement", Pos: "n.", IPA: "/əˈnaʊns.mənt/", Meaning: "公告，宣布，通告", Band: "Band 6.0"},
	{Word: "emergency", Pos: "n./adj.", IPA: "/ɪˈmɜː.dʒən.si/", Meaning: "紧急情况，突发事件；应急的", Band: "Band 6.0"},
	{Word: "resident", Pos: "n.", IPA: "/ˈrez.ɪ.dənt/", Meaning: "居民，住户", Band: "Band 6.0"},
	{Word: "Affordable", Pos: "adj.", IPA: "/əˈfɔː.də.bəl/", Meaning: "负担得起的，可承受的", Band: "Band 6.5"},
}

func defaultRadioSegments() []RadioNewsWheelSegment {
	return []RadioNewsWheelSegment{
		{
			ID:          "seg-680-traffic-weather",
			TimeMark:    "Traffic & Weather",
			Title:       "680 News Live Traffic & Weather: DVP Slowdown & Pearson Winds",
			TitleZh:     "680 News 即时路况与天气：DVP 拥堵缓行与皮尔逊机场阵风",
			Anchor:      "Stephanie Smyth & Kevin Misener",
			StartSecond: 0,
			EndSecond:   80,
			Text:        "This is 680 News. Time for traffic and weather together on the 1s. In the 680 News airborne traffic chopper, we are watching a sluggish inbound commute on the Don Valley Parkway approaching the Bloor Viaduct due to earlier road maintenance. The Gardiner Expressway is moving at posted speeds through downtown. Over at Toronto Pearson International Airport, southwesterly crosswinds are gusting up to 45 kilometers an hour with light precipitation moving through the western suburbs. Expect traffic to remain clogged near arterial junctions.",
			TextZh:      "这里是 680 News，现在是路况与天气连报时间。680 News 空中巡航直升机显示：受先前道路养护影响，进城方向的唐河谷高架路（DVP）在接近布卢尔高架桥路段车速缓慢；加德纳高速市中心路段目前按限速正常通行。多伦多皮尔逊国际机场方面，西南向侧风阵风达每小时 45 公里，西郊上空有零星弱降水云系移过。预计主干道交叉口一带路况仍将拥堵。",
			Liaisons: []RadioLiaison{
				{Phrase: "watching a", IPA: "/ˈwɒ.tʃɪŋ.ə/", NoteZh: "连读：-ing 与 a 相连，听起来像 “watchin-a”", Note: "Linking: “-ing” runs into “a”"},
				{Phrase: "crosswinds are", IPA: "/ˈkrɒs.wɪndz.ɑː/", NoteZh: "连读：词尾 /z/ 与 are 相连，are 弱读", Note: "Linking: final /z/ joins “are”, which is reduced"},
			},
			KeyLexis: []RadioVocabularyItem{
				{Word: "commute", Pos: "n./v.", IPA: "/kəˈmjuːt/", Meaning: "通勤，上下班路程；往返上下班", Band: "Band 6.0", ContextSnippet: "A sluggish inbound commute on the Don Valley Parkway approaching downtown."},
				{Word: "sluggish", Pos: "adj.", IPA: "/ˈslʌɡ.ɪʃ/", Meaning: "缓慢的，行动迟缓的，萧条的", Band: "Band 7.0", ContextSnippet: "Traffic is sluggish approaching the viaduct due to earlier maintenance."},
				{Word: "precipitation", Pos: "n.", IPA: "/prɪˌsɪp.ɪˈteɪ.ʃən/", Meaning: "降水（雨、雪等），降水量", Band: "Band 7.5", ContextSnippet: "Light precipitation is moving through the western suburbs this morning."},
				{Word: "clog", Pos: "v./n.", IPA: "/klɒɡ/", Meaning: "堵塞，阻塞，使停滞", Band: "Band 6.5", ContextSnippet: "Stalled vehicles can quickly clog essential arterial collector lanes."},
			},
		},
		{
			ID:          "seg-680-metro-bulletin",
			TimeMark:    "Top Headlines",
			Title:       "Toronto Metro News: Waterfront Transit Expansion & Housing Density Bylaw",
			TitleZh:     "多伦多大都会要闻：湖滨轻轨绿化延伸线与居住密度新附例",
			Anchor:      "Richard Southern & Carl Hanstke",
			StartSecond: 80,
			EndSecond:   175,
			Text:        "Good morning from the 680 Newsroom. Breaking news at City Hall: Council has voted overwhelmingly to expedite funding for the Waterfront East light rail corridor, linking downtown Union Station to newly revitalized port land districts. Municipal planners emphasize that new mixed-use residential zoning bylaws will mandate 20 percent affordable units alongside pedestrianized public squares and protected bike tracks.",
			TextZh:      "680 新闻编辑室早间通报。市政厅最新进展：市议会以压倒性多数投票通过，加快对湖滨东区轻轨走廊的资金拨付，打通联合车站（Union Station）至全新修缮的港口工业园区。市政规划师强调，新的商住混合分区规划附例将强制规定 20% 的保障性住房配比，并同步配建步行公共广场和隔离自行车道。",
			Liaisons: []RadioLiaison{
				{Phrase: "voted to", IPA: "/ˈvəʊ.tɪd.tə/", NoteZh: "弱读：to 读作 /tə/，t 轻快闪音", Note: "Reduction: “to” becomes /tə/"},
				{Phrase: "light rail", IPA: "/laɪt reɪl/", NoteZh: "连读：light 词尾 /t/ 轻化，与 rail 衔接", Note: "Linking: final /t/ of “light” is softened"},
			},
			KeyLexis: []RadioVocabularyItem{
				{Word: "expedite", Pos: "v.", IPA: "/ˈek.spə.daɪt/", Meaning: "加速，加快处理", Band: "Band 7.5", ContextSnippet: "Council voted to expedite funding for the light rail transit corridor."},
				{Word: "municipal", Pos: "adj.", IPA: "/mjuːˈnɪs.ɪ.pəl/", Meaning: "市政的，地方自治的", Band: "Band 7.0", ContextSnippet: "Municipal planners emphasize modern mixed-use zoning bylaws."},
				{Word: "bylaw", Pos: "n.", IPA: "/ˈbaɪ.lɔː/", Meaning: "地方法规，城市管理附例", Band: "Band 7.0", ContextSnippet: "New zoning bylaws mandate affordable residential units in the district."},
				{Word: "revitalize", Pos: "v.", IPA: "/riːˈvaɪ.təl.aɪz/", Meaning: "使复兴，赋予新生，活化", Band: "Band 7.5", ContextSnippet: "Linking downtown transit directly to revitalized port land sectors."},
			},
		},
		{
			ID:          "seg-680-business-pulse",
			TimeMark:    "Business News",
			Title:       "680 Business Pulse: TSX Trading & Bank of Canada Policy Rate Outlook",
			TitleZh:     "680 商业财经专栏：多伦多股市与加拿大央行基准利率预期",
			Anchor:      "Mike Eppel (Senior Business Editor)",
			StartSecond: 175,
			EndSecond:   265,
			Text:        "In 680 Business, checking Bay Street numbers: the TSX Composite index opened higher by 85 points, buoyed by mining equities and renewable utilities. On the macroeconomic horizon, economists at major Canadian financial institutions anticipate that the Bank of Canada will hold its benchmark policy rate steady at their upcoming announcement, as annualized core inflation cools toward the two percent target band.",
			TextZh:      "680 商业财经专栏，来看多伦多贝街金融走势：在采矿业与可再生公用事业板块提振下，多伦多证券交易所综合指数开盘上涨 85 点。宏观经济方面，加拿大主流金融机构经济学家预计，随着年化核心通胀率稳步回落至 2% 的目标区间，加拿大央行将在即将公布的决议中维持基准政策利率不变。",
			Liaisons: []RadioLiaison{
				{Phrase: "held steady", IPA: "/held ˈsted.i/", NoteZh: "连读：held 词尾 /d/ 与 steady 衔接", Note: "Linking: /d/ of “held” joins “steady”"},
				{Phrase: "opened higher", IPA: "/ˈəʊ.pənd ˈhaɪ.ər/", NoteZh: "连读：opened 词尾 /d/ 弱化", Note: "Reduction: final /d/ of “opened” is weakened"},
			},
			KeyLexis: []RadioVocabularyItem{
				{Word: "benchmark", Pos: "n./adj.", IPA: "/ˈbentʃ.mɑːk/", Meaning: "基准，标杆；基准的", Band: "Band 7.0", ContextSnippet: "The central bank is expected to hold its benchmark policy rate steady."},
				{Word: "buoy", Pos: "v.", IPA: "/bɔɪ/", Meaning: "提振，鼓励，使浮起", Band: "Band 8.0", ContextSnippet: "The stock exchange opened higher, buoyed by energy and mining equities."},
				{Word: "equity", Pos: "n.", IPA: "/ˈek.wɪ.ti/", Meaning: "股票，股权；公平，公正", Band: "Band 7.0", ContextSnippet: "Strong gains in utility equities led morning trading sessions."},
				{Word: "inflation", Pos: "n.", IPA: "/ɪnˈfleɪ.ʃən/", Meaning: "通货膨胀，物价上涨", Band: "Band 6.5", ContextSnippet: "Core inflation figures continue to align with long-term economic targets."},
			},
		},
		{
			ID:          "seg-680-lifestyle-weather",
			TimeMark:    "Sports & Culture",
			Title:       "680 News Metro Culture: Clear Skies & Harborfront Weekend Guide",
			TitleZh:     "680 News 文化与气象展望：晴朗气温与多伦多湖滨漫步指南",
			Anchor:      "Jill Taylor & Newsroom Team",
			StartSecond: 265,
			EndSecond:   360,
			Text:        "Taking a look ahead at your weekend forecast: high pressure over Southern Ontario will deliver sunny conditions with temperatures reaching a pleasant 21 degrees Celsius on Sunday. Ideal weather for visitors exploring the Kensington Market pedestrian fair and waterfront artisan markets. Stay tuned right here to 680 News for uninterrupted updates, round the clock, every ten minutes on the 1s.",
			TextZh:      "来看周末天气展望：安大略省南部受高压脊控制，全区将迎来晴好天气，周日最高气温将达到舒适的 21 摄氏度。非常适宜市民前往肯辛顿市集（Kensington Market）步行街区与湖滨文创市集游览。请持续锁定 680 News，全天候 24 小时、每 10 分钟逢 1 分不间断为您带来最新路况与天气。",
			Liaisons: []RadioLiaison{
				{Phrase: "high pressure", IPA: "/haɪ ˈpreʃ.ər/", NoteZh: "节奏：重音落在 high 与 pres-", Note: "Stress: falls on “high” and “pres-”"},
				{Phrase: "round the clock", IPA: "/raʊnd ðə klɒk/", NoteZh: "弱读：the 读作 /ðə/，连成一个节奏组", Note: "Reduction: “the” is /ðə/, one rhythm group"},
			},
			KeyLexis: []RadioVocabularyItem{
				{Word: "forecast", Pos: "n./v.", IPA: "/ˈfɔː.kɑːst/", Meaning: "天气预报，预测", Band: "Band 6.0", ContextSnippet: "Taking a look ahead at your four-day weekend forecast across the region."},
				{Word: "artisan", Pos: "n./adj.", IPA: "/ˌɑː.tɪˈzæn/", Meaning: "手工艺人，工匠；手作的", Band: "Band 7.5", ContextSnippet: "Waterfront artisan vendors will set up stalls along Queen’s Quay."},
				{Word: "uninterrupted", Pos: "adj.", IPA: "/ˌʌn.ɪn.təˈrʌp.tɪd/", Meaning: "不间断的，连续的", Band: "Band 7.0", ContextSnippet: "Stay tuned for uninterrupted news and traffic updates around the clock."},
			},
		},
	}
}
