package filetypes

// FileType defines a top-level file category used across the storage system.
// The enum is used for registry routing, access control policies, and
// metadata classification.
type FileType int

const (
	// FTBinary represents raw binary data with no known text encoding.
	FTBinary FileType = iota
	// FTText represents UTF-8 plain text files (.txt, .md, .csv, .log, .cfg).
	FTText
	// FTImage represents image files (.png, .jpg, .gif, .webp).
	FTImage
	// FTArchive represents compressed or archived containers (.zip, .tar, .gz).
	FTArchive
	// FTExecutable represents runnable binaries (.exe, .bin, .sh, .bat, .msi).
	FTExecutable
	// FTDocument represents office and document files (.pdf, .docx, .xlsx).
	FTDocument
)

// String returns the human-readable name for a FileType.
func (t FileType) String() string {
	switch t {
	case FTBinary:
		return "binary"
	case FTText:
		return "text"
	case FTImage:
		return "image"
	case FTArchive:
		return "archive"
	case FTExecutable:
		return "executable"
	case FTDocument:
		return "document"
	default:
		return "unknown"
	}
}

// IsBinary returns true when the file type is raw binary data.
func (t FileType) IsBinary() bool {
	return t == FTBinary
}

// IsExecutable returns true when the file type represents a runnable binary.
func (t FileType) IsExecutable() bool {
	return t == FTExecutable
}

// IsCompressible returns true when the file type can safely be gzip-compressed.
// Archives and executables are already binary/compressed and are excluded.
func (t FileType) IsCompressible() bool {
	switch t {
	case FTText, FTDocument, FTArchive:
		return true
	case FTBinary, FTImage, FTExecutable:
		return false
	default:
		return false
	}
}

// CategoryFor maps a file category string to a FileType enum.
// Unknown categories default to FTBinary.
func CategoryFor(category string) FileType {
	switch category {
	case "text":
		return FTText
	case "image":
		return FTImage
	case "archive":
		return FTArchive
	case "executable":
		return FTExecutable
	case "document":
		return FTDocument
	case "binary":
		return FTBinary
	default:
		return FTBinary
	}
}
