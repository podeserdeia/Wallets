from flask import Blueprint, request, jsonify
from src.models.models import Transaction, Wallet

transaction_bp = Blueprint('transaction', __name__)

@transaction_bp.route('/transactions', methods=['GET'])
def get_transactions():
    wallet_id = request.args.get('wallet_id')
    network = request.args.get('network')
    token = request.args.get('token')
    
    if wallet_id:
        transactions = Transaction.get_by_wallet(int(wallet_id))
    else:
        transactions = Transaction.get_all()
    
    # Apply filters
    if network:
        transactions = [t for t in transactions if t.network == network]
    if token:
        transactions = [t for t in transactions if t.token == token]
    
    result = []
    for t in transactions:
        wallet = Wallet.get_by_id(t.wallet_id)
        result.append({
            'id': t.id,
            'wallet_id': t.wallet_id,
            'wallet_name': wallet.name if wallet else 'Carteira não encontrada',
            'network': t.network,
            'token': t.token,
            'type': t.type,
            'amount': float(t.amount),
            'description': t.description,
            'date': t.date
        })
    
    return jsonify(result)

@transaction_bp.route('/transactions', methods=['POST'])
def add_transaction():
    data = request.get_json()
    transaction = Transaction(
        wallet_id=data['wallet_id'],
        network=data['network'],
        token=data['token'],
        type=data['type'],
        amount=float(data['amount']),
        description=data.get('description', '')
    )
    transaction.save()
    
    wallet = Wallet.get_by_id(transaction.wallet_id)
    return jsonify({
        'id': transaction.id,
        'wallet_id': transaction.wallet_id,
        'wallet_name': wallet.name if wallet else 'Carteira não encontrada',
        'network': transaction.network,
        'token': transaction.token,
        'type': transaction.type,
        'amount': float(transaction.amount),
        'description': transaction.description,
        'date': transaction.date
    }), 201

