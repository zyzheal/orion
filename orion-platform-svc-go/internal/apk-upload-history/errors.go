package apkuploadhistory

import "errors"

type ApkUploadHistoryError struct { Code string; Message string; Cause error }

func (e *ApkUploadHistoryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ApkUploadHistoryError) Is(target error) bool { _, ok := target.(*ApkUploadHistoryError); return ok }
func (e *ApkUploadHistoryError) Unwrap() error { return e.Cause }

var (
    ErrApkUploadHistoryNotFound     = &ApkUploadHistoryError{Code: "apkuploadhistory_not_found", Message: "apk-upload-history: not found"}
    ErrApkUploadHistoryInvalidInput = &ApkUploadHistoryError{Code: "apkuploadhistory_invalid_input", Message: "apk-upload-history: invalid input"}
    ErrApkUploadHistoryConflict     = &ApkUploadHistoryError{Code: "apkuploadhistory_conflict", Message: "apk-upload-history: conflict"}
    ErrApkUploadHistoryUnauthorized = &ApkUploadHistoryError{Code: "apkuploadhistory_unauthorized", Message: "apk-upload-history: unauthorized"}
    ErrApkUploadHistoryInternal     = &ApkUploadHistoryError{Code: "apkuploadhistory_internal", Message: "apk-upload-history: internal error"}
)

func NewApkUploadHistoryError(code, msg string) error { return &ApkUploadHistoryError{Code: code, Message: msg} }
func IsApkUploadHistoryNotFound(err error) bool { return errors.Is(err, ErrApkUploadHistoryNotFound) }
