#!/usr/bin/env python3
"""
Servidor Flask simples para simular a API do dashboard de criptomoedas.
Este servidor fornece endpoints para gerenciar carteiras, tokens e transações.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Arquivo para persistir dados
DATA_FILE = 'data.json'

def load_data():
    """Carrega dados do arquivo JSON ou retorna estrutura vazia."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            pass
    
    return {
        'wallets': [],
        'transactions': [],
        'next_wallet_id': 1,
        'next_transaction_id': 1,
        'next_balance_id': 1
    }

def save_data(data):
    """Salva dados no arquivo JSON."""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def calculate_balances():
    """Calcula saldos baseados nas transações."""
    data = load_data()
    
    # Reset all balances
    for wallet in data['wallets']:
        for balance in wallet['balances']:
            balance['balance'] = 0.0
    
    # Apply transactions
    for transaction in data['transactions']:
        wallet = next((w for w in data['wallets'] if w['id'] == transaction['wallet_id']), None)
        if wallet:
            balance_entry = next((b for b in wallet['balances'] 
                                if b['network'] == transaction['network'] and b['token'] == transaction['token']), None)
            if balance_entry:
                if transaction['type'] == 'entrada':
                    balance_entry['balance'] += transaction['amount']
                else:  # saida
                    balance_entry['balance'] -= transaction['amount']
    
    save_data(data)
    return data

# Servir arquivos estáticos
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# API Endpoints

@app.route('/api/wallets', methods=['GET'])
def get_wallets():
    """Retorna todas as carteiras."""
    data = calculate_balances()
    return jsonify(data['wallets'])

@app.route('/api/wallets', methods=['POST'])
def create_wallet():
    """Cria uma nova carteira."""
    data = load_data()
    
    wallet_data = request.get_json()
    
    # Validação básica
    if not wallet_data.get('name') or not wallet_data.get('address'):
        return jsonify({'error': 'Nome e endereço são obrigatórios'}), 400
    
    # Verifica se já existe uma carteira com o mesmo endereço
    if any(w['address'] == wallet_data['address'] for w in data['wallets']):
        return jsonify({'error': 'Já existe uma carteira com este endereço'}), 400
    
    new_wallet = {
        'id': data['next_wallet_id'],
        'name': wallet_data['name'],
        'address': wallet_data['address'],
        'balances': []
    }
    
    data['wallets'].append(new_wallet)
    data['next_wallet_id'] += 1
    
    save_data(data)
    return jsonify(new_wallet), 201

@app.route('/api/wallets/<int:wallet_id>', methods=['DELETE'])
def delete_wallet(wallet_id):
    """Remove uma carteira e todas as suas transações."""
    data = load_data()
    
    # Remove a carteira
    data['wallets'] = [w for w in data['wallets'] if w['id'] != wallet_id]
    
    # Remove todas as transações da carteira
    data['transactions'] = [t for t in data['transactions'] if t['wallet_id'] != wallet_id]
    
    save_data(data)
    return '', 204

@app.route('/api/wallets/<int:wallet_id>/networks', methods=['POST'])
def add_network_to_wallet(wallet_id):
    """Adiciona uma rede/token a uma carteira."""
    data = load_data()
    
    wallet = next((w for w in data['wallets'] if w['id'] == wallet_id), None)
    if not wallet:
        return jsonify({'error': 'Carteira não encontrada'}), 404
    
    network_data = request.get_json()
    
    # Validação
    if not network_data.get('network') or not network_data.get('token'):
        return jsonify({'error': 'Rede e token são obrigatórios'}), 400
    
    # Verifica se já existe esta combinação rede/token na carteira
    if any(b['network'] == network_data['network'] and b['token'] == network_data['token'] 
           for b in wallet['balances']):
        return jsonify({'error': 'Esta combinação de rede e token já existe nesta carteira'}), 400
    
    new_balance = {
        'id': data['next_balance_id'],
        'network': network_data['network'],
        'token': network_data['token'],
        'balance': float(network_data.get('balance', 0))
    }
    
    wallet['balances'].append(new_balance)
    data['next_balance_id'] += 1
    
    save_data(data)
    return jsonify(new_balance), 201

@app.route('/api/wallets/<int:wallet_id>/networks/<int:balance_id>', methods=['DELETE'])
def remove_network_from_wallet(wallet_id, balance_id):
    """Remove uma rede/token de uma carteira."""
    data = load_data()
    
    wallet = next((w for w in data['wallets'] if w['id'] == wallet_id), None)
    if not wallet:
        return jsonify({'error': 'Carteira não encontrada'}), 404
    
    # Remove o balance
    original_length = len(wallet['balances'])
    wallet['balances'] = [b for b in wallet['balances'] if b['id'] != balance_id]
    
    if len(wallet['balances']) == original_length:
        return jsonify({'error': 'Rede/token não encontrado'}), 404
    
    # Remove transações relacionadas a esta rede/token
    balance_to_remove = next((b for b in wallet['balances'] if b['id'] == balance_id), None)
    if balance_to_remove:
        data['transactions'] = [t for t in data['transactions'] 
                              if not (t['wallet_id'] == wallet_id and 
                                    t['network'] == balance_to_remove['network'] and 
                                    t['token'] == balance_to_remove['token'])]
    
    save_data(data)
    return '', 204

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Retorna todas as transações com informações da carteira."""
    data = calculate_balances()
    
    transactions_with_wallet = []
    for transaction in data['transactions']:
        wallet = next((w for w in data['wallets'] if w['id'] == transaction['wallet_id']), None)
        transaction_copy = transaction.copy()
        transaction_copy['wallet_name'] = wallet['name'] if wallet else 'Carteira removida'
        transactions_with_wallet.append(transaction_copy)
    
    return jsonify(transactions_with_wallet)

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    """Cria uma nova transação."""
    data = load_data()
    
    transaction_data = request.get_json()
    
    # Validação
    required_fields = ['wallet_id', 'network', 'token', 'type', 'amount']
    for field in required_fields:
        if field not in transaction_data:
            return jsonify({'error': f'Campo {field} é obrigatório'}), 400
    
    if transaction_data['type'] not in ['entrada', 'saida']:
        return jsonify({'error': 'Tipo deve ser "entrada" ou "saida"'}), 400
    
    if transaction_data['amount'] <= 0:
        return jsonify({'error': 'Valor deve ser maior que zero'}), 400
    
    # Verifica se a carteira existe
    wallet = next((w for w in data['wallets'] if w['id'] == transaction_data['wallet_id']), None)
    if not wallet:
        return jsonify({'error': 'Carteira não encontrada'}), 404
    
    # Verifica se a combinação rede/token existe na carteira
    balance_entry = next((b for b in wallet['balances'] 
                         if b['network'] == transaction_data['network'] and b['token'] == transaction_data['token']), None)
    if not balance_entry:
        return jsonify({'error': 'Esta combinação de rede e token não existe nesta carteira'}), 400
    
    new_transaction = {
        'id': data['next_transaction_id'],
        'wallet_id': transaction_data['wallet_id'],
        'network': transaction_data['network'],
        'token': transaction_data['token'],
        'type': transaction_data['type'],
        'amount': float(transaction_data['amount']),
        'description': transaction_data.get('description', ''),
        'date': datetime.now().isoformat()
    }
    
    data['transactions'].append(new_transaction)
    data['next_transaction_id'] += 1
    
    save_data(data)
    calculate_balances()  # Recalcula saldos após adicionar transação
    
    return jsonify(new_transaction), 201

@app.route('/api/wallets/balance', methods=['GET'])
def get_wallet_balances():
    """Retorna saldos consolidados por rede, token e carteira."""
    data = calculate_balances()
    
    balance_by_network = {}
    balance_by_token = {}
    wallet_balances = []
    
    for wallet in data['wallets']:
        wallet_total = 0
        wallet_networks = []
        
        for balance in wallet['balances']:
            # Saldo por rede
            if balance['network'] not in balance_by_network:
                balance_by_network[balance['network']] = 0
            balance_by_network[balance['network']] += balance['balance']
            
            # Saldo por token
            if balance['token'] not in balance_by_token:
                balance_by_token[balance['token']] = 0
            balance_by_token[balance['token']] += balance['balance']
            
            # Saldo da carteira
            wallet_total += balance['balance']
            wallet_networks.append({
                'network': balance['network'],
                'token': balance['token'],
                'balance': balance['balance']
            })
        
        wallet_balances.append({
            'id': wallet['id'],
            'name': wallet['name'],
            'total_balance': wallet_total,
            'networks': wallet_networks
        })
    
    return jsonify({
        'balance_by_network': balance_by_network,
        'balance_by_token': balance_by_token,
        'wallet_balances': wallet_balances
    })

if __name__ == '__main__':
    print("Iniciando servidor Flask...")
    print("Acesse: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)

