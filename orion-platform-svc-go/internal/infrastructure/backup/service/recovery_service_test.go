package service

import (
	"testing"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
)

func TestArchiveTypeFor(t *testing.T) {
	cases := map[string]models.ArchiveType{
		"wal":       models.ArchiveTypeWAL,
		"WAL":       models.ArchiveTypeWAL,
		"Wal":       models.ArchiveTypeWAL,
		"binlog":    models.ArchiveTypeBinlog,
		"Binlog":    models.ArchiveTypeBinlog,
		"BINLOG":    models.ArchiveTypeBinlog,
		"":          models.ArchiveTypeWAL, // default
		"something": models.ArchiveTypeWAL, // default
	}
	for in, want := range cases {
		if got := archiveTypeForPITRMode(in); got != want {
			t.Fatalf("archiveTypeFor(%q) = %q, want %q", in, got, want)
		}
	}
}
