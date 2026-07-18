# FRANGAIN Ecosystem Development Rules

## Project

This is the official **FRANGAIN Ecosystem**.

The project is deployed in production. Existing functionality must always be preserved, and every change must be treated with production-level care.

---

## Development Philosophy

Implement **only** the requested milestone or task.

Before writing code, analyze the existing project and determine the implementation that best fits the current architecture.

Prefer improving the existing implementation over adding unnecessary complexity.

Never implement future milestones automatically.

Never redesign the project or introduce architectural changes without explicit approval.

If an improvement, risk, or opportunity is discovered during development, explain it first, provide your recommendation, and wait for approval before making the change.

---

## Scope Control

Modify **only** the files that are necessary to complete the requested task.

Do not modify unrelated files.

If completing the task requires changing significantly more files than expected, stop, explain why, and wait for approval before proceeding.

Always prefer the smallest safe change that satisfies the requested objective.

---

## Existing Functionality

Treat every existing working feature as production code.

If a feature already works and the request is only to improve or adjust it, preserve the existing implementation whenever possible.

Do not redesign, rewrite, or replace a working feature unless explicitly requested or technically necessary.

Prefer incremental improvements over complete rewrites.

---

## Implementation Strategy

Focus on achieving the requested result rather than inventing a new implementation.

Choose the implementation that best fits the existing architecture.

Do not replace an existing implementation with a different design unless the current implementation cannot satisfy the requested requirements.

When multiple valid implementations exist, choose the solution that is:

- simplest
- most maintainable
- most consistent with the existing project
- least disruptive to existing functionality

---

## Frontend Rules

Existing HTML, CSS, and JavaScript files are production code.

Modify existing frontend files only when required to complete the requested task.

Preserve all existing functionality.

Reuse existing styles whenever possible.

Maintain the FRANGAIN visual identity throughout the application.

Avoid unnecessary UI redesigns.

---

## Backend Rules

The backend foundation uses:

- Node.js
- Vercel Serverless Functions
- MongoDB Atlas

Keep backend code modular, organized by responsibility, and easy to maintain.

Never hardcode secrets.

Always use environment variables for:

- API keys
- database connection strings
- credentials
- tokens
- deployment configuration

---

## Database

Current MongoDB collections:

- users
- claims
- withdrawals

Do not create additional collections unless explicitly requested.

---

## Coding Standards

Write clean, readable, maintainable, production-ready code.

Keep files focused on a single responsibility.

Avoid unnecessary dependencies.

Avoid duplicate code whenever possible.

Comment complex logic where future maintainers need context, especially for:

- security
- business logic
- deployment
- database operations

Follow the project's existing naming conventions and coding style.

---

## Autonomous Decisions

Act as a senior software engineer.

For every task:

- analyze the project before making changes
- understand the existing architecture
- make reasonable technical decisions independently
- preserve compatibility with existing functionality
- explain significant implementation decisions after completing the work

Do not change the project's direction or scope without explicit approval.

---

## Regression Policy

Protect existing functionality at all times.

If a proposed change would remove or alter existing behavior beyond the requested scope, stop and explain why before proceeding.

If a regression is introduced during implementation, restore the previous working behavior before attempting further improvements.

Never solve one problem by creating another.

---

## Quality Assurance

Before considering any task complete:

- verify that existing functionality still works
- check for regressions
- check for obvious performance issues
- avoid unnecessary complexity
- ensure the implementation is production-ready
- verify consistency with the existing architecture
- verify consistency with the project's coding conventions

---

## FRANGAIN Terminology

Use the official terminology consistently unless instructed otherwise:

- FRANGAIN Ecosystem
- Memory Mining
- Memory Reserve
- Mining Session
- Mining Rate
- Circle of Trust
- The Coin Remembers

---

## Communication

When reporting completed work:

Report only:

- files created
- files modified
- important implementation decisions
- verification results

Keep reports concise and focused.

---

## Golden Rule

Whenever you are uncertain about the requested functionality or requirements:

**Stop.**

Explain the uncertainty.

Recommend the best approach.

Wait for approval.

Never guess the intended behavior.

Never introduce features that were not requested.

Never redesign working functionality without explicit approval.
