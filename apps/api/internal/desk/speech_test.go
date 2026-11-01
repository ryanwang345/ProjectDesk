package desk

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func testSpeechWAV() []byte {
	data := make([]byte, 44+4800)
	copy(data, "RIFF")
	binary.LittleEndian.PutUint32(data[4:], uint32(len(data)-8))
	copy(data[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(data[16:], 16)
	binary.LittleEndian.PutUint16(data[20:], 1)
	binary.LittleEndian.PutUint16(data[22:], 1)
	binary.LittleEndian.PutUint32(data[24:], 24000)
	binary.LittleEndian.PutUint32(data[28:], 48000)
	binary.LittleEndian.PutUint16(data[32:], 2)
	binary.LittleEndian.PutUint16(data[34:], 16)
	copy(data[36:], "data")
	binary.LittleEndian.PutUint32(data[40:], 4800)
	return data
}

func speechReply(w http.ResponseWriter, transcript string, data []byte) {
	_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{
		map[string]any{"message": map[string]any{"audio": map[string]string{
			"transcript": transcript, "data": base64.StdEncoding.EncodeToString(data),
		}}},
	}})
}

func TestNormalizeSpeechRequest(t *testing.T) {
	for _, input := range []speechRequest{
		{Text: ""}, {Text: "...!!!"}, {Text: strings.Repeat("a", 601)}, {Text: "hello", Accent: "fr-FR"},
	} {
		if _, err := normalizeSpeechRequest(input); err == nil {
			t.Errorf("accepted invalid speech input: %q", input.Text)
		}
	}
	normalized, err := normalizeSpeechRequest(speechRequest{Text: "  Hello,\n world! ", Accent: "auto"})
	if err != nil || normalized.Text != "Hello, world!" || normalized.Accent != "en-GB" {
		t.Fatalf("unexpected normalization: %+v %v", normalized, err)
	}
}

func TestSpeechUsesNaturalAudioWithExactTranscriptAndDeduplicates(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/chat/completions" || r.Header.Get("Authorization") != "Bearer test-speech-key" {
			t.Error("wrong speech endpoint or authentication")
		}
		var payload struct {
			Model      string   `json:"model"`
			Store      bool     `json:"store"`
			Modalities []string `json:"modalities"`
			Audio      struct {
				Voice  string `json:"voice"`
				Format string `json:"format"`
			} `json:"audio"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Error(err)
		}
		if payload.Model != "gpt-audio-1.5" || payload.Store || payload.Audio.Voice != "marin" || payload.Audio.Format != "wav" || len(payload.Modalities) != 2 {
			t.Errorf("incorrect audio settings: %+v", payload)
		}
		if len(payload.Messages) != 2 || !strings.Contains(payload.Messages[0].Content, "natural connected speech") {
			t.Error("missing natural speech instruction")
		}
		speechReply(w, "Hello, world!", testSpeechWAV())
	}))
	defer server.Close()
	service := newSpeechService()
	cfg := speechConfig{BaseURL: server.URL, APIKey: "test-speech-key", Model: "gpt-audio-1.5", Voice: "marin"}
	input := speechRequest{Text: "Hello world", Accent: "en-GB"}
	var group sync.WaitGroup
	for i := 0; i < 10; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			data, err := service.audio(context.Background(), cfg, input)
			if err != nil || !bytes.Equal(data, testSpeechWAV()) {
				t.Errorf("wrong audio or error: %v", err)
			}
		}()
	}
	group.Wait()
	if calls.Load() != 1 {
		t.Fatalf("expected one generation for simultaneous clicks, got %d", calls.Load())
	}
	if _, err := service.audio(context.Background(), cfg, input); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("replay generated another paid request")
	}
	input.Accent = "en-US"
	if _, err := service.audio(context.Background(), cfg, input); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatal("different accents must have separate audio")
	}
}

func TestSpeechRejectsParaphrasesAndInvalidAudio(t *testing.T) {
	for _, test := range []struct {
		name, transcript string
		data             []byte
		status           int
	}{
		{"added words", "Sure, hello world", testSpeechWAV(), 200},
		{"paraphrase", "Good morning", testSpeechWAV(), 200},
		{"missing transcript", "", testSpeechWAV(), 200},
		{"not audio", "hello world", []byte(strings.Repeat("x", 100)), 200},
		{"provider failure", "hello world", testSpeechWAV(), 429},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				speechReply(w, test.transcript, test.data)
			}))
			defer server.Close()
			service := newSpeechService()
			_, err := service.audio(context.Background(), speechConfig{BaseURL: server.URL, APIKey: "test", Model: "gpt-audio-1.5", Voice: "marin"}, speechRequest{Text: "hello world", Accent: "en-GB"})
			if err == nil {
				t.Fatal("invalid speech was accepted")
			}
			if len(service.cache) != 0 {
				t.Fatal("failed speech must not enter the cache")
			}
		})
	}
}

func TestSpeechRoutesWithoutConfigurationAndWithAudio(t *testing.T) {
	for _, key := range []string{"PROJECT_DESK_SPEECH_API_KEY", "OPENAI_API_KEY", "PROJECT_DESK_SPEECH_BASE_URL", "PROJECT_DESK_SPEECH_MODEL", "PROJECT_DESK_SPEECH_VOICE"} {
		t.Setenv(key, "")
	}
	handler := NewHandler(nil, nil)
	request := func(method, body string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(method, "/api/english/speech", strings.NewReader(body)))
		return response
	}
	if response := request("GET", ""); response.Code != 200 || !strings.Contains(response.Body.String(), `"available":false`) {
		t.Fatal("unconfigured status should support device fallback")
	}
	if response := request("POST", `{"text":"hello"}`); response.Code != 503 {
		t.Fatal("unconfigured audio should return 503")
	}
	for _, body := range []string{`{"text":""}`, `{"text":"hello","accent":"fr"}`, `{"text":"hello","apiKey":"client-secret"}`, `invalid`} {
		if response := request("POST", body); response.Code != 400 {
			t.Errorf("invalid request returned %d", response.Code)
		}
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { speechReply(w, "hello", testSpeechWAV()) }))
	defer server.Close()
	t.Setenv("PROJECT_DESK_SPEECH_API_KEY", "test-server-secret")
	t.Setenv("PROJECT_DESK_SPEECH_BASE_URL", server.URL)
	response := request("POST", `{"text":"hello","accent":"en-US"}`)
	if response.Code != 200 || response.Header().Get("Content-Type") != "audio/wav" || response.Header().Get("X-Pronunciation-Source") != "ai-generated" || !bytes.Equal(response.Body.Bytes(), testSpeechWAV()) {
		t.Fatalf("incorrect audio response: %d", response.Code)
	}
	if strings.Contains(response.Body.String(), "test-server-secret") {
		t.Fatal("credential leaked")
	}
}

func TestOpenAICredentialIsNotReusedForCustomSpeechEndpoint(t *testing.T) {
	t.Setenv("PROJECT_DESK_SPEECH_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "test-openai-secret")
	t.Setenv("PROJECT_DESK_SPEECH_BASE_URL", "https://other.example/v1")
	if _, err := (&Handler{}).speechConfiguration(context.Background()); err == nil {
		t.Fatal("a custom endpoint must require an explicit speech credential")
	}
}
