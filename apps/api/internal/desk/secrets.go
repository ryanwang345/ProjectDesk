package desk

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
	"regexp"
	"strings"
)

// ErrNoSecretKey means PROJECT_DESK_SECRET_KEY is unset, so API keys cannot
// be stored. Providers that need no key (Ollama, demo) still work.
var ErrNoSecretKey = errors.New("PROJECT_DESK_SECRET_KEY is not set, so API keys cannot be stored")

// Sealer encrypts provider API keys at rest with AES-256-GCM. The key is
// derived from the configured secret, so rotating the secret requires
// re-entering provider keys.
type Sealer struct {
	key []byte
}

func NewSealer(secret string) *Sealer {
	if secret == "" {
		return &Sealer{}
	}
	sum := sha256.Sum256([]byte(secret))
	return &Sealer{key: sum[:]}
}

func (s *Sealer) Enabled() bool { return len(s.key) == 32 }

func (s *Sealer) Seal(plain string) ([]byte, error) {
	if !s.Enabled() {
		return nil, ErrNoSecretKey
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(plain), nil), nil
}

func (s *Sealer) Open(sealed []byte) (string, error) {
	if len(sealed) == 0 {
		return "", nil
	}
	if !s.Enabled() {
		return "", ErrNoSecretKey
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(sealed) < gcm.NonceSize() {
		return "", errors.New("stored secret is too short")
	}
	plain, err := gcm.Open(nil, sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():], nil)
	if err != nil {
		return "", errors.New("stored secret cannot be decrypted with the current PROJECT_DESK_SECRET_KEY")
	}
	return string(plain), nil
}

// credentialPattern catches the common shapes of API keys and tokens:
// bearer headers, OpenAI/Anthropic/GitHub/Docker prefixes, and long opaque
// key=value secrets.
var credentialPattern = regexp.MustCompile(
	`(?i)(bearer\s+[a-z0-9._\-]{8,}|sk-[a-z0-9_\-]{8,}|sk-ant-[a-z0-9_\-]{8,}|github_pat_[a-z0-9_]{8,}|gh[pousr]_[a-z0-9]{8,}|dckr_pat_[a-z0-9_\-]{8,}|xai-[a-z0-9]{8,}|(api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?[^\s"',;]{6,})`)

// Redact hides anything that looks like a credential before it is logged
// or stored in an audit event. Known secrets are removed verbatim; common
// token shapes are removed by pattern.
func Redact(text string, secrets ...string) string {
	for _, s := range secrets {
		if len(s) >= 6 {
			text = strings.ReplaceAll(text, s, "[redacted]")
		}
	}
	return credentialPattern.ReplaceAllString(text, "[redacted]")
}
