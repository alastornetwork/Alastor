package jcs

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"unicode/utf16"
)

func compareUTF16(a, b string) bool {
	ua := utf16.Encode([]rune(a))
	ub := utf16.Encode([]rune(b))
	limit := len(ua)
	if len(ub) < limit {
		limit = len(ub)
	}
	for i := 0; i < limit; i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

func writeEscapedString(buf *bytes.Buffer, s string) {
	buf.WriteByte('"')
	for _, r := range s {
		switch r {
		case '\b':
			buf.WriteString(`\b`)
		case '\t':
			buf.WriteString(`\t`)
		case '\n':
			buf.WriteString(`\n`)
		case '\f':
			buf.WriteString(`\f`)
		case '\r':
			buf.WriteString(`\r`)
		case '"':
			buf.WriteString(`\"`)
		case '\\':
			buf.WriteString(`\\`)
		default:
			if r < 0x20 {
				buf.WriteString(fmt.Sprintf(`\u%04x`, r))
			} else {
				buf.WriteRune(r)
			}
		}
	}
	buf.WriteByte('"')
}

func writeCanonical(buf *bytes.Buffer, v any) error {
	switch val := v.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		if val {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
	case json.Number:
		buf.WriteString(val.String())
	case string:
		writeEscapedString(buf, val)
	case []any:
		buf.WriteByte('[')
		for i, item := range val {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := writeCanonical(buf, item); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool {
			return compareUTF16(keys[i], keys[j])
		})
		buf.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			writeEscapedString(buf, k)
			buf.WriteByte(':')
			if err := writeCanonical(buf, val[k]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')
	default:
		return fmt.Errorf("unsupported JSON value %T", v)
	}
	return nil
}

// HashPayloadJCS canonicalizes a decoded JSON object per RFC 8785 and returns its SHA-256 hex digest.
func HashPayloadJCS(payload any) ([]byte, string, error) {
	var buf bytes.Buffer
	if err := writeCanonical(&buf, payload); err != nil {
		return nil, "", err
	}
	canonical := buf.Bytes()
	sum := sha256.Sum256(canonical)
	return canonical, hex.EncodeToString(sum[:]), nil
}
