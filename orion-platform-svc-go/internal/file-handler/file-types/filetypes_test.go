package filetypes

import (
	"testing"
)

func TestFileTypeString(t *testing.T) {
	tests := map[FileType]string{
		FTBinary:     "binary",
		FTText:       "text",
		FTImage:      "image",
		FTArchive:    "archive",
		FTExecutable: "executable",
		FTDocument:   "document",
	}
	for typ, want := range tests {
		if got := typ.String(); got != want {
			t.Errorf("FileType(%d).String() = %q, want %q", typ, got, want)
		}
	}
	// Unknown value
	if (FileType)(99).String() != "unknown" {
		t.Error("unknown type should return 'unknown'")
	}
}

func TestFileTypeIsBinary(t *testing.T) {
	if !FTBinary.IsBinary() {
		t.Error("FTBinary.IsBinary() should be true")
	}
	if FTText.IsBinary() {
		t.Error("FTText.IsBinary() should be false")
	}
}

func TestFileTypeIsExecutable(t *testing.T) {
	if !FTExecutable.IsExecutable() {
		t.Error("FTExecutable.IsExecutable() should be true")
	}
	if FTBinary.IsExecutable() {
		t.Error("FTBinary.IsExecutable() should be false")
	}
}

func TestFileTypeIsCompressible(t *testing.T) {
	compressible := []FileType{FTText, FTDocument, FTArchive}
	incompressible := []FileType{FTBinary, FTImage, FTExecutable}
	for _, ft := range compressible {
		if !ft.IsCompressible() {
			t.Errorf("%s should be compressible", ft.String())
		}
	}
	for _, ft := range incompressible {
		if ft.IsCompressible() {
			t.Errorf("%s should not be compressible", ft.String())
		}
	}
	if (FileType)(99).IsCompressible() {
		t.Error("unknown type should not be compressible")
	}
}

func TestCategoryFor(t *testing.T) {
	tests := map[string]FileType{
		"text":       FTText,
		"image":      FTImage,
		"archive":    FTArchive,
		"executable": FTExecutable,
		"document":   FTDocument,
		"binary":     FTBinary,
		"unknown":    FTBinary,
		"":           FTBinary,
	}
	for cat, want := range tests {
		if got := CategoryFor(cat); got != want {
			t.Errorf("CategoryFor(%q) = %s, want %s", cat, got.String(), want.String())
		}
	}
}

func TestPDFHandler(t *testing.T) {
	h := PDFHandler{}
	if h.Extension() != ".pdf" {
		t.Errorf("Extension = %q", h.Extension())
	}
	if h.MIMEType() != "application/pdf" {
		t.Errorf("MIMEType = %q", h.MIMEType())
	}
	if h.Category() != "document" {
		t.Errorf("Category = %q", h.Category())
	}
	// Valid PDF magic bytes
	if h.Validate([]byte("%PDF-1.4")) != nil {
		t.Error("valid PDF should pass")
	}
	// Invalid
	if h.Validate([]byte("not a pdf")) == nil {
		t.Error("invalid PDF should fail")
	}
}

func TestJPEGHandler(t *testing.T) {
	h := JPEGHandler{}
	if h.Extension() != ".jpg" {
		t.Errorf("Extension = %q", h.Extension())
	}
	if h.Validate([]byte("\xFF\xD8\xFF\xDB")) != nil {
		t.Error("valid JPEG magic bytes should pass")
	}
	if h.Validate([]byte("not a jpeg")) == nil {
		t.Error("invalid JPEG should fail")
	}
}

func TestPNGHandler(t *testing.T) {
	h := PNGHandler{}
	if h.Extension() != ".png" {
		t.Errorf("Extension = %q", h.Extension())
	}
	pngMagic := []byte("\x89PNG\r\n\x1a\n")
	if h.Validate(pngMagic) != nil {
		t.Error("valid PNG should pass")
	}
	if h.Validate([]byte("not a png")) == nil {
		t.Error("invalid PNG should fail")
	}
}

func TestGIFHandler(t *testing.T) {
	h := GIFHandler{}
	if h.Extension() != ".gif" {
		t.Errorf("Extension = %q", h.Extension())
	}
	if h.Validate([]byte("GIF89a")) != nil {
		t.Error("valid GIF should pass")
	}
	if h.Validate([]byte("not a gif")) == nil {
		t.Error("invalid GIF should fail")
	}
}

func TestZipHandler(t *testing.T) {
	h := ZipHandler{}
	if h.Extension() != ".zip" {
		t.Errorf("Extension = %q", h.Extension())
	}
	zipMagic := []byte("PK\x03\x04\x00\x00")
	if h.Validate(zipMagic) != nil {
		t.Error("valid ZIP should pass")
	}
	if h.Validate([]byte("not a zip")) == nil {
		t.Error("invalid ZIP should fail")
	}
	if h.MaxSize() != largeMaxSize {
		t.Errorf("MaxSize = %d, want %d", h.MaxSize(), largeMaxSize)
	}
}

func TestGoHandler(t *testing.T) {
	h := GoHandler{}
	if h.Extension() != ".go" {
		t.Errorf("Extension = %q", h.Extension())
	}
	if h.Category() != "code" {
		t.Errorf("Category = %q", h.Category())
	}
	if h.Validate([]byte{}) != nil {
		t.Error("Go source should accept any content")
	}
	if h.MaxSize() != 10*1024*1024 {
		t.Errorf("MaxSize = %d", h.MaxSize())
	}
}

func TestRegistry(t *testing.T) {
	r := NewRegistry()

	// Should find built-in types
	h, ok := r.Get(".pdf")
	if !ok {
		t.Error("should find .pdf handler")
	}
	if ok && h.Category() != "document" {
		t.Errorf("pdf category = %q", h.Category())
	}

	// Accept extension without dot
	h2, ok2 := r.Get("png")
	if !ok2 {
		t.Error("should find png without dot")
	}
	if ok2 && h2.Extension() != ".png" {
		t.Errorf("png extension = %q", h2.Extension())
	}

	// Missing type
	_, ok3 := r.Get(".mp3")
	if ok3 {
		t.Error("should not find .mp3")
	}
}

func TestGenericHandler(t *testing.T) {
	h := NewGenericHandler(".xyz", "application/xyz", "custom")
	if h.Extension() != ".xyz" {
		t.Errorf("Extension = %q", h.Extension())
	}
	if h.MIMEType() != "application/xyz" {
		t.Errorf("MIMEType = %q", h.MIMEType())
	}
	if h.Category() != "custom" {
		t.Errorf("Category = %q", h.Category())
	}
	if h.Validate([]byte("anything")) != nil {
		t.Error("generic should accept anything")
	}
	if h.MaxSize() != defaultMaxSize {
		t.Errorf("MaxSize = %d", h.MaxSize())
	}
}

func TestRegistryRegister(t *testing.T) {
	r := &Registry{handlers: make(map[string]Handler)}
	generic := NewGenericHandler(".foo", "text/foo", "x")
	r.Register(generic)
	h, ok := r.Get(".foo")
	if !ok {
		t.Error("should find registered .foo")
	}
	if ok && h.Extension() != ".foo" {
		t.Error("wrong handler returned")
	}
}

func TestRegistryEmptyExt(t *testing.T) {
	r := &Registry{handlers: make(map[string]Handler)}
	r.Register(NewGenericHandler("", "x", "x"))
	_, ok := r.Get(".")
	if ok {
		t.Error("empty extension should be skipped")
	}
}
