# Test Results - Sub-Suppliers Standalone Page

## Feature: Standalone Sub-Suppliers List Page

### Test Scenarios to Verify:

1. **API Endpoint `/api/sub-suppliers`**
   - GET request returns list of sub-suppliers
   - Pagination works (page, limit params)
   - Filters work: status, pipeline_stage, assigned_to, search, overdue
   - Searchers only see their assigned sub-suppliers

2. **API Endpoint `/api/sub-suppliers/ids`**
   - Returns all IDs for bulk operations
   - Only accessible by admin/super_admin

3. **Frontend Sub-Suppliers Page**
   - Page loads at `/sub-suppliers`
   - Table displays all columns correctly
   - Filters work: search, status, stage, searcher, overdue
   - Click on row navigates to detail page
   - Click on parent brand navigates to brand detail

4. **Sidebar Navigation**
   - "Под-сапплаеры" link visible for all roles
   - Admin/Super-admin see all sub-suppliers
   - Searcher sees only their assigned sub-suppliers

### Credentials:
- Super Admin: admin@procto13.com / admin123 / PROCTO13
- Searcher: searcher@procto13.com / searcher123 / PROCTO13

### Incorporate User Feedback:
- User wants sub-suppliers to be standalone entities
- They should be trackable without going into parent brand
- They have their own pipeline, notes, contacts
