"""AI actions: small, single-purpose AI steps inside the app (explain a figure, read a scenario sentence, ...).

Two kinds. Explaining actions get a facts pack the engine computed and write a few sentences citing facts by id,
exactly like the board-pack commentary, so the model never writes a number. Parsing actions turn the person's
own words into structured fields for them to confirm; every number they return must appear in those words.
"""
