// orion-platform-service/src/services/output-validation/PatchSchemaDefinition.ts
export const PATCH_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LLM Patch Output Schema",
  "description": "Schema for validating LLM-generated patch outputs",
  "type": "object",
  "required": ["patch_id", "target_files", "changes", "metadata"],
  "properties": {
    "patch_id": {
      "type": "string",
      "pattern": "^patch_[a-z0-9]{16}$",
      "description": "Unique patch identifier"
    },
    "target_files": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["path", "operation"],
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9_/.-]+\\.(ts|js|py|go|java)$",
            "description": "File path must match allowed extensions"
          },
          "operation": {
            "type": "string",
            "enum": ["create", "modify", "delete"],
            "description": "Operation type"
          },
          "lines": {
            "type": "object",
            "properties": {
              "start": { "type": "integer", "minimum": 1 },
              "end": { "type": "integer", "minimum": 1 }
            }
          }
        }
      }
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file_path", "change_type", "content"],
        "properties": {
          "file_path": {
            "type": "string"
          },
          "change_type": {
            "type": "string",
            "enum": ["insertion", "deletion", "replacement"]
          },
          "content": {
            "type": "string",
            "maxLength": 10000,
            "description": "Code content to apply"
          },
          "original_content": {
            "type": "string",
            "description": "Original content for replacement"
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "required": ["generated_by", "timestamp"],
      "properties": {
        "generated_by": {
          "type": "string",
          "enum": ["llm_autofix", "llm_code_review", "llm_refactor"]
        },
        "timestamp": {
          "type": "string",
          "format": "date-time"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "rationale": {
          "type": "string",
          "maxLength": 500
        }
      }
    }
  }
};

// Security boundary constraints
export const SECURITY_BOUNDARY_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Patch Security Boundary",
  "type": "object",
  "required": ["allowed_paths", "disallowed_patterns"],
  "properties": {
    "allowed_paths": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Allowed file path patterns",
      "default": [
        "src/**/*.ts",
        "src/**/*.js",
        "lib/**/*.py",
        "app/**/*.go"
      ]
    },
    "disallowed_patterns": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Disallowed file patterns",
      "default": [
        "**/.env*",
        "**/credentials*",
        "**/secrets*",
        "**/config*.json",
        "**/*.pem",
        "**/*.key"
      ]
    },
    "max_file_size": {
      "type": "integer",
      "default": 100000,
      "description": "Max file size in bytes"
    },
    "max_changes_per_patch": {
      "type": "integer",
      "default": 10,
      "description": "Max number of files changed per patch"
    }
  }
};