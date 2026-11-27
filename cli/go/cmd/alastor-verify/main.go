package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/alastorprotocol/alastor/cli/go/internal/jcs"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: alastor-verify <proof.json> [trusted-sha256]")
		os.Exit(2)
	}

	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading proof file: %v\n", err)
		os.Exit(1)
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var doc map[string]any
	if err := dec.Decode(&doc); err != nil {
		fmt.Fprintf(os.Stderr, "invalid JSON: %v\n", err)
		os.Exit(1)
	}

	payload, ok := doc["payload"].(map[string]any)
	if !ok {
		fmt.Fprintln(os.Stderr, "missing payload object")
		os.Exit(1)
	}
	digestObj, ok := doc["digest"].(map[string]any)
	if !ok {
		fmt.Fprintln(os.Stderr, "missing digest envelope")
		os.Exit(1)
	}

	canonical, recomputed, err := jcs.HashPayloadJCS(payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "canonicalization failed: %v\n", err)
		os.Exit(1)
	}

	embedded, _ := digestObj["value"].(string)
	embedded = strings.ToLower(embedded)
	selfConsistent := embedded == recomputed

	fmt.Printf("Schema:            %v\n", payload["schema"])
	fmt.Printf("Canonical Bytes:   %d\n", len(canonical))
	fmt.Printf("Embedded SHA-256:  %s\n", embedded)
	fmt.Printf("Computed SHA-256:  %s\n", recomputed)
	fmt.Printf("Self-Consistent:   %v\n", selfConsistent)

	if len(os.Args) >= 3 {
		trusted := strings.ToLower(os.Args[2])
		matches := recomputed == trusted
		fmt.Printf("Trusted Match:     %v\n", matches)
		if !matches {
			os.Exit(1)
		}
	}

	if !selfConsistent {
		os.Exit(1)
	}
}
