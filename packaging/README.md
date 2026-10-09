Drop the two instruction PDFs here, exactly named:

- `Ultimate_Budget_Welcome.pdf`
- `Ultimate_Budget_StartHere.pdf`

Then run `python3 build-customer-zip.py` from the repo root. It picks them up
automatically and places them at the root of the zip, next to `index.html`.

Nothing in this folder is part of the live app or gets deployed to Netlify.
It only feeds `build-customer-zip.py`.
