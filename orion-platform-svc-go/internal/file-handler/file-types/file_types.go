package filetypes

import (
	"bytes"
	"errors"
	"strings"
)

// --- Type handler registry ---

// Handler defines the capabilities for a single file type.
type Handler interface {
	Extension() string
	MIMEType() string
	Category() string
	MaxSize() int64
	Validate(data []byte) error
}

// defaultMaxSize is the maximum upload size for most file types (50 MB).
const defaultMaxSize = 50 * 1024 * 1024

// largeMaxSize is the maximum upload size for archives and media (200 MB).
const largeMaxSize = 200 * 1024 * 1024

// --- Concrete type handlers ---

// PDFHandler validates PDF files by checking the magic bytes.
type PDFHandler struct{}

func (PDFHandler) Extension() string { return ".pdf" }
func (PDFHandler) MIMEType() string  { return "application/pdf" }
func (PDFHandler) Category() string  { return "document" }
func (PDFHandler) MaxSize() int64    { return defaultMaxSize }
func (PDFHandler) Validate(data []byte) error {
	if !bytes.HasPrefix(data, []byte("%PDF")) {
		return errors.New("file is not a valid PDF")
	}
	return nil
}

// JPEGHandler validates JPEG files.
type JPEGHandler struct{}

func (JPEGHandler) Extension() string { return ".jpg" }
func (JPEGHandler) MIMEType() string  { return "image/jpeg" }
func (JPEGHandler) Category() string  { return "image" }
func (JPEGHandler) MaxSize() int64    { return defaultMaxSize }
func (JPEGHandler) Validate(data []byte) error {
	if !bytes.HasPrefix(data, []byte("\xFF\xD8\xFF")) {
		return errors.New("file is not a valid JPEG")
	}
	return nil
}

// PNGHandler validates PNG files.
type PNGHandler struct{}

func (PNGHandler) Extension() string { return ".png" }
func (PNGHandler) MIMEType() string  { return "image/png" }
func (PNGHandler) Category() string  { return "image" }
func (PNGHandler) MaxSize() int64    { return defaultMaxSize }
func (PNGHandler) Validate(data []byte) error {
	if !bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) {
		return errors.New("file is not a valid PNG")
	}
	return nil
}

// GIFHandler validates GIF files.
type GIFHandler struct{}

func (GIFHandler) Extension() string { return ".gif" }
func (GIFHandler) MIMEType() string  { return "image/gif" }
func (GIFHandler) Category() string  { return "image" }
func (GIFHandler) MaxSize() int64    { return defaultMaxSize }
func (GIFHandler) Validate(data []byte) error {
	if !bytes.HasPrefix(data, []byte("GIF8")) {
		return errors.New("file is not a valid GIF")
	}
	return nil
}

// GoHandler validates Go source files.
type GoHandler struct{}

func (GoHandler) Extension() string { return ".go" }
func (GoHandler) MIMEType() string  { return "text/x-go" }
func (GoHandler) Category() string  { return "code" }
func (GoHandler) MaxSize() int64    { return 10 * 1024 * 1024 }
func (GoHandler) Validate(_ []byte) error {
	// Go source is UTF-8 text; accept any non-empty content.
	return nil
}

// TsHandler validates TypeScript source files.
type TsHandler struct{}

func (TsHandler) Extension() string { return ".ts" }
func (TsHandler) MIMEType() string  { return "text/typescript" }
func (TsHandler) Category() string  { return "code" }
func (TsHandler) MaxSize() int64    { return 10 * 1024 * 1024 }
func (TsHandler) Validate(_ []byte) error {
	return nil
}

// JsonHandler validates JSON files.
type JsonHandler struct{}

func (JsonHandler) Extension() string { return ".json" }
func (JsonHandler) MIMEType() string  { return "application/json" }
func (JsonHandler) Category() string  { return "config" }
func (JsonHandler) MaxSize() int64    { return 10 * 1024 * 1024 }
func (JsonHandler) Validate(_ []byte) error {
	return nil
}

// YamlHandler validates YAML files.
type YamlHandler struct{}

func (YamlHandler) Extension() string { return ".yaml" }
func (YamlHandler) MIMEType() string  { return "text/yaml" }
func (YamlHandler) Category() string  { return "config" }
func (YamlHandler) MaxSize() int64    { return 10 * 1024 * 1024 }
func (YamlHandler) Validate(_ []byte) error {
	return nil
}

// TxtHandler validates plain text files.
type TxtHandler struct{}

func (TxtHandler) Extension() string { return ".txt" }
func (TxtHandler) MIMEType() string  { return "text/plain" }
func (TxtHandler) Category() string  { return "document" }
func (TxtHandler) MaxSize() int64    { return defaultMaxSize }
func (TxtHandler) Validate(_ []byte) error {
	return nil
}

// ZipHandler validates ZIP archives.
type ZipHandler struct{}

func (ZipHandler) Extension() string { return ".zip" }
func (ZipHandler) MIMEType() string  { return "application/zip" }
func (ZipHandler) Category() string  { return "archive" }
func (ZipHandler) MaxSize() int64    { return largeMaxSize }
func (ZipHandler) Validate(data []byte) error {
	if !bytes.HasPrefix(data, []byte("PK\x03\x04")) {
		return errors.New("file is not a valid ZIP archive")
	}
	return nil
}

// GenericHandler accepts any file type (no validation).
type GenericHandler struct {
	ext string
	mime string
	cat string
}

func NewGenericHandler(ext, mime, cat string) *GenericHandler {
	return &GenericHandler{ext: ext, mime: mime, cat: cat}
}

func (h *GenericHandler) Extension() string { return h.ext }
func (h *GenericHandler) MIMEType() string  { return h.mime }
func (h *GenericHandler) Category() string  { return h.cat }
func (h *GenericHandler) MaxSize() int64    { return defaultMaxSize }
func (h *GenericHandler) Validate(_ []byte) error {
	return nil
}

// --- Registry ---

// Registry holds the mapped type handlers.
type Registry struct {
	handlers map[string]Handler // key = lowercase extension
}

// NewRegistry creates a registry with built-in handlers.
func NewRegistry() *Registry {
	r := &Registry{
		handlers: make(map[string]Handler),
	}
	r.Register(PDFHandler{})
	r.Register(JPEGHandler{})
	r.Register(PNGHandler{})
	r.Register(GIFHandler{})
	r.Register(GoHandler{})
	r.Register(TsHandler{})
	r.Register(JsonHandler{})
	r.Register(YamlHandler{})
	r.Register(TxtHandler{})
	r.Register(ZipHandler{})
	return r
}

// Register adds a type handler to the registry.
func (r *Registry) Register(h Handler) {
	ext := strings.ToLower(h.Extension())
	if ext == "" {
		return
	}
	r.handlers[ext] = h
}

// Get returns the handler for the given extension.
func (r *Registry) Get(ext string) (Handler, bool) {
	ext = strings.ToLower(ext)
	if ext != "" && ext[0] != '.' {
		ext = "." + ext
	}
	h, ok := r.handlers[ext]
	return h, ok
}
