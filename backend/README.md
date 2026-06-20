# Oddo Backend API

This is the backend API project built with FastAPI.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Unix/MacOS: `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

## Validation & Schemas

The API leverages Pydantic for strict data validation:
- **Phone Numbers**: Phone number fields automatically default to prefixing `+91` if exactly 10 digits are provided, and enforce exactly 10 digits after the country code.
- **Strict Typing**: All schemas enforce minimum and maximum lengths for strings, bounds for numeric values, and valid email formats for better data integrity.
