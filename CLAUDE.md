# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mundl Noten** is a secure grade management web application for teachers. It allows authenticated users to:
- View student photos in a grid layout
- Record and manage grades for students with encrypted storage
- Export grades to CSV format
- Upload student photos in batch

All sensitive data (student grades and photos) is encrypted client-side using AES-GCM encryption before being stored in Firebase Realtime Database.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Backend/Database**: Firebase Realtime Database
- **Authentication**: Firebase Authentication (email/password)
- **UI Library**: SweetAlert2 for modals
- **Encryption**: Web Crypto API (AES-GCM with PBKDF2 key derivation)

## Project Structure

The application consists of several HTML pages with corresponding JavaScript modules:

- **login.html + login.js**: Authentication page
- **index.html + rating.js**: Main grading interface with student photo grid
- **picsupload.html + picsuploadjs.js**: Batch student photo upload
- **export.html + exportjs.js**: Grade export to CSV
- **styles.css**: Shared styles
- **firebase_rules.txt**: Firebase Realtime Database security rules

## Development Workflow

Since this is a client-side web application:

1. **No build step required** - open HTML files directly in browser or use a local server
2. **Local server** (recommended to avoid CORS issues):
   ```
   python -m http.server 8000
   ```
   or
   ```
   npx serve
   ```
3. **Testing**: Manual testing in browser (Chrome/Firefox recommended for Web Crypto API)

## Key Architecture Patterns

### Data Encryption Flow

All sensitive data uses client-side encryption:

1. **Key Derivation**: User password → PBKDF2 (100k iterations, SHA-256) → AES-GCM key
2. **Encryption**: Data + random salt + random IV → encrypted payload
3. **Storage**: Encrypted data + IV + salt stored in Firebase
4. **Decryption**: Retrieve encrypted data + IV + salt → derive key → decrypt

The encryption functions are duplicated across files (rating.js, exportjs.js, picsuploadjs.js). Changes to crypto logic must be applied to all files.

### Firebase Data Structure

```
/pictures
  /{schoolYear}        // e.g., "2024-2025"
    /{classId}         // e.g., "E1ME2"
      /{studentId}     // e.g., "Max_Mustermann" (Vorname_Nachname)
        - encryptedData: {encrypted, iv, salt}
        - vorname: "Max"
        - nachname: "Mustermann"
        - schuljahr: "2024-2025"

/grades
  /{gradeId}          // Format: "{studentId}_{date}_{classId}"
    - studentId: "Max_Mustermann"
    - classId: "E1ME2"
    - date: "2025-03-15"
    - studentId_date_class: "Max_Mustermann_2025-03-15_E1ME2"
    - encryptedData: {encrypted, iv, salt}  // Contains {note, comment}
    - vorname: "Max"
    - nachname: "Mustermann"
    - schuljahr: "2024-2025"
```

**Important**: The `studentId_date_class` field is indexed in Firebase rules for efficient queries.

### Student Memory Feature

The current branch `studentmemory` tracks student-specific data across sessions. The main rating interface (rating.js):

1. Loads student photos from Firebase based on school year and class
2. Displays students in a grid (32 boxes)
3. On click, shows a modal to enter/edit grades
4. Stores grades encrypted in Firebase with student metadata
5. Maintains a local cache of recent comments for quick reuse

### Authentication Flow

All pages except login.html require authentication:

1. Check `onAuthStateChanged`
2. If not authenticated → redirect to login.html with `redirectTo` in sessionStorage
3. After successful login → redirect back to original target
4. All pages have logout button that calls `signOut(auth)`

## Important Implementation Details

### Photo Upload Naming Convention

Student photos must be named: `Nachname_Vorname.jpg` (e.g., `Mustermann_Max.jpg`)
- The filename is parsed to extract first and last names
- Multiple photos can be uploaded simultaneously
- Photos are encrypted as binary data (ArrayBuffer) before storage

### Grade Data Storage

Grades are encrypted as JSON: `{note: "1-6", comment: "text"}`
- Each grade record includes: studentId, classId, date, vorname, nachname, schuljahr
- The composite key `studentId_date_class` enables querying grades by student+date+class

### Image Decryption and Display

When loading student images (rating.js:131-261):
1. Query Firebase for all students in selected class/school year
2. For each student, decrypt image using encryption password
3. Convert decrypted ArrayBuffer to base64 data URL
4. Display in corresponding grid box with student name label
5. If decryption fails (wrong password), box remains empty and metadata is cleared

### CSV Export Format

Export creates semicolon-separated CSV:
```
"Vorname";"Nachname";"Datum";"Thema";"Note"
"Max";"Mustermann";"15.03.2025";"Excellent work";"1"
```

Date format: DD.MM.YYYY (converted from YYYY-MM-DD stored format)

## Firebase Configuration

The Firebase config (API key, database URL, etc.) is **hardcoded** in each JS file. This is intentional for this educational project but should be moved to environment variables in production.

**Security**: Firebase rules in firebase_rules.txt enforce authentication. All reads/writes require `auth != null`.

## Common Tasks

### Add a new page

1. Create HTML file with Firebase SDK imports
2. Create corresponding JS module
3. Copy authentication check from existing files (onAuthStateChanged)
4. Copy crypto functions if dealing with encrypted data
5. Add navigation links in other pages if needed

### Modify encryption scheme

**CRITICAL**: Encryption functions are duplicated in rating.js, exportjs.js, and picsuploadjs.js. Any changes must be applied to all three files to maintain compatibility.

### Change Firebase data structure

1. Update the database write operations in the relevant JS files
2. Update Firebase rules in firebase_rules.txt
3. Apply rules to Firebase console
4. Ensure indexed fields match query requirements

### Debug decryption issues

Common causes:
- Wrong encryption password entered
- Data encrypted with different password
- Corrupted encrypted data in database
- Mismatch in encryption implementation between upload and retrieval

Check browser console for detailed error messages from crypto operations.

## Main Branch

Default branch for PRs: **main**

Current development branch: **studentmemory** (working on persistent student data tracking)
