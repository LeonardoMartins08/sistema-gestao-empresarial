"""SQLite helpers used by the Flask application."""
import sqlite3
from pathlib import Path

import click
from flask import current_app, g


def get_db():
    """Return one SQLite connection for the current Flask request or command."""
    if "db" not in g:
        database_path = current_app.config["DATABASE"]
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def close_db(_exception=None):
    """Close the request's connection after Flask finishes handling it."""
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def init_db():
    """Create the application tables from the SQLite schema file."""
    schema_path = Path(current_app.root_path) / "database" / "schema_sqlite.sql"
    with schema_path.open("r", encoding="utf-8") as schema_file:
        get_db().executescript(schema_file.read())


def init_app(app):
    app.teardown_appcontext(close_db)

    @app.cli.command("init-db")
    def init_db_command():
        init_db()
        click.echo("Banco SQLite inicializado.")
