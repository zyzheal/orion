package database_devops

import (
    "bytes"
    "context"
    "fmt"
    "os/exec"
    "time"

    "gorm.io/gorm"
)

type BackupService struct {
    repo    *BackupRepository
    dbRepo  *DatabaseRepository
}

func NewBackupService(db *gorm.DB) *BackupService {
    return &BackupService{
        repo:   NewBackupRepository(db),
        dbRepo: NewDatabaseRepository(db),
    }
}

func (s *BackupService) ExecuteBackup(ctx context.Context, policy BackupPolicy) error {
    db, err := s.dbRepo.GetByID(ctx, policy.DatabaseID)
    if err != nil { return fmt.Errorf("database not found: %w", err) }

    buf := new(bytes.Buffer)
    var cmd *exec.Cmd
    connStr := fmt.Sprintf("host=%s port=%d user=%s dbname=%s password=%s",
        db.Host, db.Port, db.Username, db.DBName, db.Password)
    switch db.Engine {
    case "postgres":
        cmd = exec.CommandContext(ctx, "pg_dump", "-Fc", "-d", connStr)
    case "mysql":
        cmd = exec.CommandContext(ctx, "mysqldump", "--single-transaction", "--routines", db.DBName)
    default:
        return fmt.Errorf("unsupported engine: %s", db.Engine)
    }
    cmd.Stdout = buf
    cmd.Stderr = buf

    record := &BackupRecord{
        PolicyID:   policy.ID,
        DatabaseID: policy.DatabaseID,
        Status:     "running",
        StartedAt:  ptrTime(time.Now()),
        TenantID:   policy.TenantID,
    }
    if err := s.repo.CreateRecord(ctx, record); err != nil {
        return fmt.Errorf("create backup record: %w", err)
    }

    started := time.Now()
    if err := cmd.Run(); err != nil {
        finished := time.Now()
        record.Status = "failed"
        record.Errors = buf.String()
        record.FinishedAt = &finished
        record.Duration = int(finished.Sub(started).Seconds())
        _ = s.repo.UpdateStatus(ctx, record.ID, "failed", &finished)
        return fmt.Errorf("backup failed: %w (logs: %s)", err, buf.String())
    }

    finished := time.Now()
    record.Status = "succeeded"
    record.Path = fmt.Sprintf("/backups/%s/%s-%d.dump", db.Engine, policy.DatabaseID, started.Unix())
    record.SizeBytes = int64(buf.Len())
    record.FinishedAt = &finished
    record.Duration = int(finished.Sub(started).Seconds())
    if err := s.repo.UpdateStatus(ctx, record.ID, "succeeded", &finished); err != nil {
        return fmt.Errorf("update backup status: %w", err)
    }
    return nil
}

func (s *BackupService) Restore(ctx context.Context, record BackupRecord, databaseID string) error {
    db, err := s.dbRepo.GetByID(ctx, databaseID)
    if err != nil { return fmt.Errorf("database not found: %w", err) }
    if record.Status != "succeeded" { return fmt.Errorf("backup not completed") }
    if record.Path == "" { return fmt.Errorf("backup path not found") }

    var cmd *exec.Cmd
    connStr := fmt.Sprintf("host=%s port=%d user=%s dbname=%s password=%s",
        db.Host, db.Port, db.Username, db.DBName, db.Password)
    switch db.Engine {
    case "postgres":
        cmd = exec.CommandContext(ctx, "pg_restore", "-c", "-d", connStr, record.Path)
    case "mysql":
        cmd = exec.CommandContext(ctx, "mysql", "-h", db.Host, "-P", fmt.Sprintf("%d", db.Port),
            "-u", db.Username, "-p"+db.Password, db.DBName)
    default:
        return fmt.Errorf("unsupported engine: %s", db.Engine)
    }

    op := &DBOperation{
        DatabaseID: databaseID,
        Type:       "restore",
        Status:     "running",
        Command:    record.Path,
        TenantID:   db.TenantID,
        StartedAt:  ptrTime(time.Now()),
    }
    opRepo := NewOperationRepository(db)
    _ = opRepo.Create(ctx, op)

    var buf bytes.Buffer
    cmd.Stdout = &buf
    cmd.Stderr = &buf
    started := time.Now()
    if err := cmd.Run(); err != nil {
        finished := time.Now()
        op.Status = "failed"
        op.Logs = buf.String()
        op.FinishedAt = &finished
        _ = opRepo.UpdateStatus(ctx, op.ID, "failed")
        return fmt.Errorf("restore failed: %w (logs: %s)", err, buf.String())
    }
    finished := time.Now()
    op.Status = "succeeded"
    op.Progress = 100
    op.Logs = buf.String()
    op.FinishedAt = &finished
    _ = opRepo.UpdateStatus(ctx, op.ID, "succeeded")
    return nil
}

func ptrTime(t time.Time) *time.Time { return &t }