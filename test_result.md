# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Система управления брендами для PROCTO 13 LLC на русском языке.
  Роли: Admin, Searcher. Импорт из Excel, воронка брендов, KPI, функция отмены (Undo),
  статусы ON_HOLD, NO_RESPONSE, аналитика и массовые действия.

backend:
  - task: "User Authentication (Login with Email, Password, Secret Code)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Auth implemented with JWT, roles admin/searcher"

  - task: "Brand CRUD and Status Management"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Full brand lifecycle: IN_POOL, ASSIGNED, IN_WORK, WAITING, ON_HOLD, outcomes"

  - task: "No Response Status (POST /brands/{id}/no-response)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "New status NO_RESPONSE to distinguish 'no reply' from declines"

  - task: "Undo Last Action (POST /brands/{id}/undo, GET /brands/{id}/last-action)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10-minute undo window, reverts status/stage changes"

  - task: "On Hold Status (POST /brands/{id}/on-hold)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "ON_HOLD with reason and review_date"

  - task: "Analytics KPI (GET /analytics/kpi)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "KPI leaderboard with weighted scores"

  - task: "Review Timeout Detection (GET /analytics/review-timeout)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Detects brands stuck in REVIEW status"

  - task: "Inactive Brands Detection (GET /analytics/inactive-brands)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Finds brands without activity"

  - task: "Shared Contacts Detection (GET /analytics/shared-contacts)"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Finds brands with same website domain"

  - task: "Health Score Calculation"
    implemented: true
    working: NA
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "calculate_health_score function for brand quality"

frontend:
  - task: "Login Page"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/LoginPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Dark theme login with email, password, secret code"

  - task: "Dashboard with Alerts"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/DashboardPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Shows alerts for inactive brands, admin sees all"

  - task: "Analytics Page (KPI, Timeouts, Duplicates)"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/AnalyticsPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "KPI leaderboard, Review timeout, Inactive brands, Shared contacts"

  - task: "Brand Detail Page with All Actions"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/BrandDetailPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Stage, Outcome, NoResponse, OnHold, Problematic, Return, Undo buttons"

  - task: "NoResponseModal Component"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/BrandDetailPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Modal for 'no response' status with required note"

  - task: "Undo Button with Timer"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/BrandDetailPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Shows remaining minutes for undo window"

  - task: "On Hold Modal"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/BrandDetailPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Modal with reason and review date fields"

  - task: "Brands List Page"
    implemented: true
    working: NA
    file: "/app/frontend/src/pages/BrandsPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "Table with search, filters by status/stage/searcher"

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "User Authentication"
    - "No Response Status"
    - "Undo Last Action"
    - "On Hold Status"
    - "Analytics KPI"
    - "Analytics Page"
    - "Brand Detail Page with All Actions"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Фазы 2 и 3 полностью реализованы. Нужно полное тестирование.
      
  - agent: "testing"
    message: |
      Тестирование завершено: 98% успех
      Backend: 100% (18/18 тестов)
      Frontend: 95%
      
      ВСЕ ТЕСТЫ ПРОШЛИ:
      1. NO_RESPONSE status - работает
      2. Undo functionality - работает (10-мин окно)
      3. ON_HOLD status - работает
      4. Analytics KPI - работает
      5. Analytics timeout checking - работает
      6. Analytics shared contacts - работает
      7. Frontend login - работает
      8. Analytics page UI - работает
      9. Brand detail page - все кнопки работают
      10. No Response modal - работает
      11. On Hold modal - работает
      
  - agent: "main"
    message: |
      Фазы 2 и 3 полностью завершены и протестированы!
      Credentials:
      - Admin: admin@procto13.com / admin123 / PROCTO13
      - Searcher: searcher@procto13.com / searcher123 / PROCTO13
