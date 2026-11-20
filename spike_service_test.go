package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSpikeDocumentService_InitialDocumentPreservation(t *testing.T) {
	tempDir := t.TempDir()

	fileA := filepath.Join(tempDir, "fileA.md")
	fileB := filepath.Join(tempDir, "fileB.md")

	if err := os.WriteFile(fileA, []byte("# File A"), 0644); err != nil {
		t.Fatalf("failed to write fileA: %v", err)
	}
	if err := os.WriteFile(fileB, []byte("# File B"), 0644); err != nil {
		t.Fatalf("failed to write fileB: %v", err)
	}

	docService := NewSpikeDocumentService(nil)

	// Verify initial document is empty before any load
	emptyDoc := docService.GetCurrentDocument()
	if emptyDoc.FilePath != "" || emptyDoc.Content != "" {
		t.Fatalf("expected empty initial document, got %+v", emptyDoc)
	}

	// 1. Initial document loaded via CLI
	docA, err := docService.LoadFile(fileA)
	if err != nil {
		t.Fatalf("LoadFile(fileA) failed: %v", err)
	}
	docService.SetInitialDocument(docA)

	if got := docService.GetInitialDocument(); got.FilePath != fileA {
		t.Errorf("GetInitialDocument() = %q, want %q", got.FilePath, fileA)
	}
	if got := docService.GetCurrentDocument(); got.FilePath != fileA {
		t.Errorf("GetCurrentDocument() = %q, want %q", got.FilePath, fileA)
	}

	// 2. Subsequent LoadFile calls during tab restoration (e.g., fileB) must not overwrite initialDoc
	docB, err := docService.LoadFile(fileB)
	if err != nil {
		t.Fatalf("LoadFile(fileB) failed: %v", err)
	}
	if docB.FilePath != fileB {
		t.Errorf("docB.FilePath = %q, want %q", docB.FilePath, fileB)
	}

	// GetCurrentDocument() must STILL return fileA (the initial CLI document)
	if got := docService.GetCurrentDocument(); got.FilePath != fileA {
		t.Errorf("GetCurrentDocument() after LoadFile(fileB) = %q, want %q", got.FilePath, fileA)
	}
	if got := docService.GetInitialDocument(); got.FilePath != fileA {
		t.Errorf("GetInitialDocument() = %q, want %q", got.FilePath, fileA)
	}
}
