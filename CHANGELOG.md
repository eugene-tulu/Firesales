# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

## [1.2.0] - 2025-11-16

### Added
- Flash sale functionality with product scraping capabilities
- Create flash sale page with URL input and product review workflow
- Flash sale detail page with inventory tracking and shareable links
- Integration with Firecrawl for product information extraction
- Go Live functionality to activate flash sales
- Role-based access control (RBAC) system with capability mapping
- Authorization guard factory for secure function access
- Enhanced admin dashboard with user management and statistics
- Capability-based route guards for improved security
- Audit logging for admin actions
- Truncate data functionality for admin users
- User profile management with role assignments
- Export functionality for data tables
- Virtualized select component for better performance with large datasets
- Phone field component with formatting
- Address and contact fields components
- Document review feedback component
- Gateway diagnostics for AI services
- Credit purchase system for AI usage
- Usage alerts for AI consumption

### Changed
- Enhanced product schema to support flash sale functionality
- Updated dashboard with flash sale creation button
- Refactored authentication system with improved security guards
- Updated route guards to use capability-based access control
- Improved error handling and logging in auth components
- Enhanced data table components with additional features
- Updated UI components with accessibility improvements
- Improved performance monitoring hooks
- Enhanced form validation with Zod schemas
- Updated AI playground with additional features

### Fixed
- Fixed import typo in flash sale creation route
- Improved error handling in auth guard functions
- Fixed timeout issues in route guard functions
- Resolved issues with user role validation
- Fixed potential hanging requests in authentication
- Corrected type safety issues in server functions

## [1.1.0] - 2025-11-15

### Added
- Flash sale functionality with product scraping capabilities
- Create flash sale page with URL input and product review workflow
- Flash sale detail page with inventory tracking and shareable links
- Integration with Firecrawl for product information extraction
- Go Live functionality to activate flash sales

### Changed
- Enhanced product schema to support flash sale functionality
- Updated dashboard with flash sale creation button

### Fixed
- Various improvements to product management workflow

## [1.0.0] - 2025-1-15

### Added
- Initial project setup with TanStack Start
- Convex integration for backend services
- Better Auth for authentication
- Tailwind CSS and Shadcn/UI for styling
- Dashboard with metrics and user management
- AI integration with multiple providers
- Audit logging system
- Rate limiting functionality
- Environment setup scripts