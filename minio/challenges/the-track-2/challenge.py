from flask import Flask, request, render_template_string
import os

app = Flask(__name__)

@app.route("/")
def index():
    return """
<!DOCTYPE html>
<html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Ada Lovelace</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #fafafa; }
            header { text-align: center; margin-bottom: 20px; }
            h1 { color: #2c3e50; }
            article { max-width: 700px; margin: auto; text-align: justify; }
            form { text-align: center; margin-top: 20px; }
            input, button { padding: 10px; font-size: 16px; margin: 5px; }
            footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #7f8c8d; }
        </style>
    </head>
    <body>
        <header>
            <h1>Ada Lovelace</h1>
        </header>
        <article>
            <p>
                Ada Lovelace, fille du poète Lord Byron, est reconnue comme la première programmeuse
                de l'histoire. Dans les années 1840, elle a collaboré avec Charles Babbage sur la
                machine analytique, une des premières conceptions d'un ordinateur mécanique.
            </p>

            <p>
                Ses notes sur cette machine incluent ce qui est considéré comme le premier algorithme
                destiné à être exécuté par une machine. Visionnaire, elle a imaginé que les ordinateurs
                pourraient un jour aller au-delà des simples calculs pour manipuler du texte, des images et plus encore.
            </p>
        </article>
        <div style="display:none;">
            <p>
                Hello les devs, pour info vous avez la TDL pour le developpement sur cette page : 
                /devPageAdaTDL
            </p>
        </div>
        <form method="POST" action="/chall">
            <input type="text" name="name" id="name" placeholder="Entrez votre prénom" required><br>
            <button type="submit">Envoyer</button>
        </form>
        <footer>
            <p>&copy; 2025 unph ADAL</p>
        </footer>
    </body>
</html>
    """


@app.route("/devPageAdaTDL")
def dev():
    return """
    <h1>To Do List</h1>
    <ul>
        <li>Corriger les bugs de la page d'accueil</li>
        <li>Ajouter une biographie plus complète</li>
        <li>Vérifier le contenu du fichier <code>H1dd3n-_F1@g.txt</code></li>
        <li>Améliorer le style CSS de la page principale</li>
        <li>Simplifier le code</li>
        <li>Finir le site</li>
    </ul>
    <form method="GET" action="/">
        <button type="submit">Retour</button>
    </form>
    """


@app.route("/chall", methods=["POST"])
def chall():
    name = request.form.get("name", "anonyme")
    template = f"""
    <h2>Bonjour, {name} !</h2>
    <p>Cette page est en cours de construction, revenez plus tard {name}</p>
    """
    return render_template_string(template, os=os)

@app.route("/flag")
def flag():
    return "Non"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005) 