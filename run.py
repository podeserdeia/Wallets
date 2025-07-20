from waitress import serve
from src.main import app
import logging
import os

# Configura um logger básico para ver as requisições e erros
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

if __name__ == '__main__':
# Use a variável de ambiente FLASK_ENV para determinar o modo
    # 'production' (padrão) ou 'development'
    env = os.environ.get('FLASK_ENV', 'production')

    if env == 'development':
        print("Servidor de desenvolvimento iniciado em http://127.0.0.1:5004. Use CTRL+C para parar.")
        # O modo de depuração do Flask fornece recarregamento automático e melhores mensagens de erro
        app.run(host='0.0.0.0', port=5004, debug=True)
    else:
        print("Servidor de produção iniciado em http://0.0.0.0:5004")
        serve(app, host='0.0.0.0', port=5004)
