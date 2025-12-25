# Full Role Audit - Admin, Super Admin, Searcher

## Test Objective
Complete audit of all features for each role to ensure everything works correctly.

## Credentials:
- **Super Admin:** admin@procto13.com / admin123 / PROCTO13
- **Admin:** azamat@gmail.com / azamat / AZAMAT  
- **Searcher:** searcher@procto13.com / searcher123 / PROCTO13

## Features to Test per Role

### SUPER ADMIN (admin@procto13.com)
1. **Dashboard** - /dashboard - View stats, KPIs, searcher activity
2. **Analytics** - /analytics - Charts and metrics
3. **Tasks** - /tasks - Create/edit/delete tasks
4. **Users** - /users - Manage users (CRUD)
5. **Staff** - /staff - Staff management
6. **Import** - /import - Upload CSV files
7. **All Brands** - /brands - View all brands, bulk actions
8. **Sub-Suppliers** - /sub-suppliers - View all, bulk actions (NEW!)
9. **Super Admin Panel** - /super-admin - Check-ins, Imports, Archive, Blacklist, Settings
10. **BASH** - /bash - Batch management
11. **Suppliers** - /suppliers - Supplier management
12. **Settings** - /settings - System settings

### ADMIN (azamat@gmail.com)
Same as Super Admin but verify any restrictions

### SEARCHER (searcher@procto13.com)
1. **My Brands** - /my-brands - View assigned brands
2. **Sub-Suppliers** - /sub-suppliers - View only assigned sub-suppliers
3. **Problematic** - /problematic - View problematic brands
4. **Suppliers** - /suppliers - View suppliers
5. **Check-in** - Button in sidebar
6. **Brand Detail** - Full functionality (stage completion, replied, problematic, etc.)
7. **Sub-Supplier Detail** - Full functionality

## Bulk Operations for Sub-Suppliers (NEW!)
Test these endpoints:
- POST /api/sub-suppliers/bulk-release - Release to pool
- POST /api/sub-suppliers/bulk-assign?user_id=X - Assign to user
- POST /api/sub-suppliers/bulk-archive - Archive
- DELETE /api/sub-suppliers/bulk-delete - Delete (super_admin only)

## Incorporate User Feedback:
- Test ALL functions for each role
- Document any issues found
- Verify bulk operations work for sub-suppliers
