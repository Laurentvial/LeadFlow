# Permission Duplicate Prevention

This document outlines all the protections in place to prevent duplicate permissions from being created.

## Protection Layers

### 1. Database Level (Model Constraint)
**Location:** `backend/api/models.py`

The `Permission` model has a `unique_together` constraint:
```python
class Meta:
    unique_together = ['component', 'field_name', 'action', 'status']
```

This ensures that at the database level, no two permissions can have the same combination of:
- `component`
- `field_name` (null is treated as a value)
- `action`
- `status` (null is treated as a value)

### 2. Serializer Validation (API Level)
**Location:** `backend/api/serializer.py` - `PermissionSerializer.validate()`

The serializer validates before creation/update:
- Checks that only 'statuses' and 'note_categories' components can have statusId
- Checks for duplicate permissions before allowing creation
- Provides clear error messages if duplicates are detected

### 3. Serializer Create Method (Extra Safety)
**Location:** `backend/api/serializer.py` - `PermissionSerializer.create()`

Additional safety checks in the `create()` method:
- Double-checks that only allowed components can have statusId
- Verifies no duplicate exists before creating
- Catches database integrity errors and converts them to user-friendly validation errors

### 4. Signals Protection
**Location:** `backend/api/signals.py`

#### Status Creation Signal (`create_permissions_for_new_status`)
- Uses `get_or_create()` to prevent duplicates
- **Only creates status-specific permissions for 'statuses' and 'note_categories' components**
- Skips all other components (dashboard, contacts, fosse, users, teams, planning, permissions, mails, other)

#### Role Creation Signal (`create_permissions_for_new_role`)
- Uses `get_or_create()` to prevent duplicates
- Only creates permissions without status (page-level permissions)

### 5. Views Protection
**Location:** `backend/api/views.py` - `permission_create()`

The view uses the serializer, which means all serializer validations apply automatically.

## Rules Enforced

1. **No duplicates:** Permissions must be unique by (component, field_name, action, status)
2. **Only 'statuses' and 'note_categories' can have statusId:** All other components (dashboard, contacts, fosse, users, teams, planning, permissions, notifications, mails, other) cannot have status-specific permissions
3. **Status-specific permissions are restricted:** When creating permissions with a status, only 'statuses' and 'note_categories' components are allowed

## Testing

To verify protections are working:

1. **Test duplicate prevention:**
   ```bash
   # Try to create a duplicate via API - should fail with validation error
   ```

2. **Test component with statusId (not allowed):**
   ```bash
   # Try to create permission: component='contacts', statusId='some-status' - should fail
   # Try to create permission: component='mails', statusId='some-status' - should fail
   # Only 'statuses' and 'note_categories' can have statusId
   ```

3. **Check for existing duplicates:**
   ```bash
   python manage.py remove_duplicate_permissions --dry-run
   ```

## Management Commands

- `remove_duplicate_permissions` - Find and remove duplicate permissions
- `remove_invalid_status_permissions` - Remove permissions where non-statuses/non-note_categories components have statusId
- `remove_non_status_note_permissions` - Remove permissions where component is not 'statuses' or 'note_categories' but has statusId
- `remove_statuses_permissions` - Remove statuses permissions with null statusId (if needed)
- `create_statuses_permissions` - Create statuses permissions with null statusId (if missing)

