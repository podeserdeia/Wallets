from flask import Blueprint, request, jsonify
from src.models.models import Wallet, WalletBalance, Transaction

wallet_bp = Blueprint('wallet', __name__)

@wallet_bp.route('/wallets', methods=['GET'])
def get_wallets():
    wallets = Wallet.get_all()
    result = []
    for wallet in wallets:
        balances = WalletBalance.get_by_wallet(wallet.id)
        wallet_data = {
            'id': wallet.id,
            'name': wallet.name,
            'address': wallet.address,
            'balances': [{
                'id': b.id,
                'network': b.network,
                'token': b.token,
                'balance': float(b.balance)
            } for b in balances]
        }
        result.append(wallet_data)
    return jsonify(result)

@wallet_bp.route('/wallets', methods=['POST'])
def add_wallet():
    data = request.get_json()
    wallet = Wallet(
        name=data['name'],
        address=data['address']
    )
    wallet.save()
    return jsonify({
        'id': wallet.id,
        'name': wallet.name,
        'address': wallet.address,
        'balances': []
    }), 201

@wallet_bp.route('/wallets/<int:wallet_id>', methods=['DELETE'])
def delete_wallet(wallet_id):
    wallet = Wallet.get_by_id(wallet_id)
    if wallet:
        Wallet.delete(wallet_id)
        return jsonify({'message': 'Carteira removida com sucesso'}), 200
    return jsonify({'error': 'Carteira não encontrada'}), 404

@wallet_bp.route('/wallets/<int:wallet_id>/networks', methods=['POST'])
def add_network_to_wallet(wallet_id):
    data = request.get_json()
    network = data['network']
    token = data['token']
    initial_balance = float(data.get('balance', 0.0))
    
    wallet = Wallet.get_by_id(wallet_id)
    if not wallet:
        return jsonify({'error': 'Carteira não encontrada'}), 404
    
    # Check if network+token combination already exists for this wallet
    existing_balance = WalletBalance.get_by_wallet_network_token(wallet_id, network, token)
    if existing_balance:
        return jsonify({'error': 'Esta combinação de rede e token já existe para esta carteira'}), 400
    
    wallet_balance = WalletBalance(wallet_id, network, token, initial_balance)
    wallet_balance.save()
    
    return jsonify({
        'id': wallet_balance.id,
        'network': wallet_balance.network,
        'token': wallet_balance.token,
        'balance': float(wallet_balance.balance)
    }), 201

@wallet_bp.route('/wallets/<int:wallet_id>/networks/<int:balance_id>', methods=['DELETE'])
def remove_network_from_wallet(wallet_id, balance_id):
    wallet = Wallet.get_by_id(wallet_id)
    if not wallet:
        return jsonify({'error': 'Carteira não encontrada'}), 404
    
    WalletBalance.delete(balance_id)
    return jsonify({'message': 'Rede removida da carteira com sucesso'}), 200

@wallet_bp.route('/wallets/balance', methods=['GET'])
def get_balance():
    wallets = Wallet.get_all()
    if not wallets:
        return jsonify({'error': 'Nenhuma carteira cadastrada'}), 404

    total_balance = 0.0
    balance_by_network = {}
    balance_by_token = {}
    wallet_balances = []

    for wallet in wallets:
        wallet_balance_data = {
            'id': wallet.id,
            'name': wallet.name,
            'networks': []
        }
        
        balances = WalletBalance.get_by_wallet(wallet.id)
        wallet_total = 0.0
        
        for balance in balances:
            balance_float = float(balance.balance)
            wallet_balance_data['networks'].append({
                'network': balance.network,
                'token': balance.token,
                'balance': balance_float
            })
            wallet_total += balance_float
            
            # Group by network
            if balance.network not in balance_by_network:
                balance_by_network[balance.network] = 0.0
            balance_by_network[balance.network] += balance_float
            
            # Group by token
            token_key = f"{balance.token} ({balance.network})"
            if token_key not in balance_by_token:
                balance_by_token[token_key] = 0.0
            balance_by_token[token_key] += balance_float
        
        wallet_balance_data['total_balance'] = wallet_total
        wallet_balances.append(wallet_balance_data)
        total_balance += wallet_total

    return jsonify({
        'total_balance': total_balance,
        'balance_by_network': balance_by_network,
        'balance_by_token': balance_by_token,
        'wallet_balances': wallet_balances
    })

