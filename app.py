"""Flask entry point for the ERP."""
import hmac
import os
from pathlib import Path
import secrets
import sqlite3
from decimal import Decimal, InvalidOperation

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

import db


def create_app():
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder="assets",
        static_url_path="/assets",
    )
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY") or secrets.token_hex(32),
        DATABASE=str(Path(app.instance_path) / "erp.sqlite3"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    db.init_app(app)

    def csrf_value():
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        return session["csrf_token"]

    def check_csrf():
        expected = session.get("csrf_token", "")
        submitted = request.form.get("csrf_token", "")
        if not expected or not submitted or not hmac.compare_digest(expected, submitted):
            abort(400, description="Formulário expirado. Atualize a página e tente novamente.")

    @app.context_processor
    def inject_csrf_token():
        return {"csrf_token": csrf_value()}

    @app.get("/")
    def index():
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return render_template("index.html")

    @app.get("/index.html")
    def old_index_redirect():
        return redirect(url_for("index"))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if session.get("user_id"):
            return redirect(url_for("index"))

        if request.method == "POST":
            check_csrf()
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("senha", "")
            user = db.get_db().execute(
                "SELECT id, nome, email, senha_hash, ativo FROM usuarios WHERE email = ? LIMIT 1",
                (email,),
            ).fetchone()

            if user and user["ativo"] and check_password_hash(user["senha_hash"], password):
                session.clear()
                session["user_id"] = user["id"]
                session["user_name"] = user["nome"]
                session["user_email"] = user["email"]
                csrf_value()
                return redirect(url_for("index"))

            flash("E-mail ou senha incorretos.", "error")

        return render_template("login.html")

    @app.route("/cadastro", methods=["GET", "POST"])
    def cadastro():
        if session.get("user_id"):
            return redirect(url_for("index"))

        if request.method == "POST":
            check_csrf()
            name = request.form.get("nome", "").strip()
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("senha", "")
            password_confirmation = request.form.get("confirmar_senha", "")

            email_parts = email.split("@")
            valid_email = (
                len(email_parts) == 2
                and bool(email_parts[0])
                and "." in email_parts[1]
                and not any(character.isspace() for character in email)
            )
            if not name or len(name) > 100 or not valid_email or len(email) > 190:
                flash("Informe um nome e um e-mail válidos.", "error")
                return render_template("cadastro.html")
            if len(password) < 8:
                flash("A senha precisa ter pelo menos 8 caracteres.", "error")
                return render_template("cadastro.html")
            if password != password_confirmation:
                flash("As senhas não coincidem.", "error")
                return render_template("cadastro.html")

            try:
                connection = db.get_db()
                connection.execute(
                    "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
                    (name, email, generate_password_hash(password)),
                )
                connection.commit()
            except sqlite3.IntegrityError:
                flash("Já existe uma conta com esse e-mail.", "error")
                return render_template("cadastro.html")

            flash("Conta criada. Entre com seu e-mail e sua senha.", "success")
            return redirect(url_for("login"))

        return render_template("cadastro.html")

    @app.post("/logout")
    def logout():
        check_csrf()
        session.clear()
        flash("Você saiu da sua conta.", "success")
        return redirect(url_for("login"))

    @app.post("/produtos/novo")
    def create_product():
        if not session.get("user_id"):
            return redirect(url_for("login"))
        check_csrf()

        name = request.form.get("nome", "").strip()
        description = request.form.get("descricao", "").strip()
        price_text = request.form.get("preco", "").strip().replace(",", ".")
        quantity_text = request.form.get("quantidade", "").strip()
        minimum_text = request.form.get("estoque_minimo", "").strip()

        try:
            price = Decimal(price_text)
            quantity = int(quantity_text)
            minimum = int(minimum_text)
        except (InvalidOperation, ValueError):
            flash("Informe preço e quantidades válidos.", "error")
            return redirect(url_for("index") + "#produtos")

        if (not name or len(name) > 120 or len(description) > 255
                or not price.is_finite() or price < 0
                or quantity < 0 or minimum < 0):
            flash("Revise os dados. O nome é obrigatório e preço e estoque não podem ser negativos.", "error")
            return redirect(url_for("index") + "#produtos")

        connection = db.get_db()
        connection.execute(
            """INSERT INTO produtos (nome, descricao, preco, quantidade, estoque_minimo)
               VALUES (?, ?, ?, ?, ?)""",
            (name, description or None, str(price), quantity, minimum),
        )
        connection.commit()
        flash(f'Produto "{name}" cadastrado com sucesso.', "success")
        return redirect(url_for("index") + "#produtos")

    @app.get("/pages/<path:filename>")
    def page_fragment(filename):
        if not session.get("user_id"):
            abort(401)
        if filename == "produtos/produtos.html":
            products = db.get_db().execute(
                """SELECT id, nome, descricao, preco, quantidade, estoque_minimo
                   FROM produtos ORDER BY id DESC"""
            ).fetchall()
            return render_template("product_form.html", products=products)
        return send_from_directory(str(Path(app.root_path) / "pages"), filename)

    @app.get("/health")
    def health():
        db.get_db().execute("SELECT 1").fetchone()
        return jsonify({"status": "ok", "database": "connected"})

    return app


app = create_app()
