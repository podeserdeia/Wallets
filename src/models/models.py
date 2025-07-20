import sqlite3
from datetime import datetime

DATABASE_NAME = 'wallet_tracker.db'

class Wallet:
    def __init__(self, name, address, id=None):
        self.id = id
        self.name = name
        self.address = address

    def save(self):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        if self.id:
            cursor.execute("UPDATE wallets SET name=?, address=? WHERE id=?",
                           (self.name, self.address, self.id))
        else:
            cursor.execute("INSERT INTO wallets (name, address) VALUES (?, ?)",
                           (self.name, self.address))
            self.id = cursor.lastrowid
        conn.commit()
        conn.close()

    @staticmethod
    def get_all():
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, address FROM wallets")
        wallets = []
        for row in cursor.fetchall():
            wallets.append(Wallet(id=row[0], name=row[1], address=row[2]))
        conn.close()
        return wallets

    @staticmethod
    def get_by_id(wallet_id):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, address FROM wallets WHERE id=?", (wallet_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return Wallet(id=row[0], name=row[1], address=row[2])
        return None

    @staticmethod
    def delete(wallet_id):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        # Delete wallet balances first
        cursor.execute("DELETE FROM wallet_balances WHERE wallet_id=?", (wallet_id,))
        # Delete transactions
        cursor.execute("DELETE FROM transactions WHERE wallet_id=?", (wallet_id,))
        # Delete wallet
        cursor.execute("DELETE FROM wallets WHERE id=?", (wallet_id,))
        conn.commit()
        conn.close()

class WalletBalance:
    def __init__(self, wallet_id, network, token, balance=0.0, id=None):
        self.id = id
        self.wallet_id = wallet_id
        self.network = network
        self.token = token
        self.balance = balance

    def save(self):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        if self.id:
            cursor.execute("UPDATE wallet_balances SET wallet_id=?, network=?, token=?, balance=? WHERE id=?",
                           (self.wallet_id, self.network, self.token, self.balance, self.id))
        else:
            cursor.execute("INSERT INTO wallet_balances (wallet_id, network, token, balance) VALUES (?, ?, ?, ?)",
                           (self.wallet_id, self.network, self.token, self.balance))
            self.id = cursor.lastrowid
        conn.commit()
        conn.close()

    @staticmethod
    def get_by_wallet(wallet_id):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, wallet_id, network, token, balance FROM wallet_balances WHERE wallet_id=?", (wallet_id,))
        balances = []
        for row in cursor.fetchall():
            balances.append(WalletBalance(id=row[0], wallet_id=row[1], network=row[2], token=row[3], balance=row[4]))
        conn.close()
        return balances

    @staticmethod
    def get_by_wallet_network_token(wallet_id, network, token):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, wallet_id, network, token, balance FROM wallet_balances WHERE wallet_id=? AND network=? AND token=?", 
                       (wallet_id, network, token))
        row = cursor.fetchone()
        conn.close()
        if row:
            return WalletBalance(id=row[0], wallet_id=row[1], network=row[2], token=row[3], balance=row[4])
        return None

    @staticmethod
    def get_all():
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, wallet_id, network, token, balance FROM wallet_balances")
        balances = []
        for row in cursor.fetchall():
            balances.append(WalletBalance(id=row[0], wallet_id=row[1], network=row[2], token=row[3], balance=row[4]))
        conn.close()
        return balances

    @staticmethod
    def delete(balance_id):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM wallet_balances WHERE id=?", (balance_id,))
        conn.commit()
        conn.close()

class Transaction:
    def __init__(self, wallet_id, network, token, type, amount, description=None, date=None, id=None):
        self.id = id
        self.wallet_id = wallet_id
        self.network = network
        self.token = token
        self.type = type
        self.amount = amount
        self.description = description
        self.date = date if date else datetime.now().isoformat()

    def save(self):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        if self.id:
            cursor.execute("UPDATE transactions SET wallet_id=?, network=?, token=?, type=?, amount=?, description=?, date=? WHERE id=?",
                           (self.wallet_id, self.network, self.token, self.type, self.amount, self.description, self.date, self.id))
        else:
            cursor.execute("INSERT INTO transactions (wallet_id, network, token, type, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (self.wallet_id, self.network, self.token, self.type, self.amount, self.description, self.date))
            self.id = cursor.lastrowid
            
            # Update wallet balance
            wallet_balance = WalletBalance.get_by_wallet_network_token(self.wallet_id, self.network, self.token)
            if wallet_balance:
                if self.type == 'entrada':
                    wallet_balance.balance += self.amount
                else:
                    wallet_balance.balance -= self.amount
                wallet_balance.save()
            else:
                # Create new balance entry
                initial_balance = self.amount if self.type == 'entrada' else -self.amount
                new_balance = WalletBalance(self.wallet_id, self.network, self.token, initial_balance)
                new_balance.save()
                
        conn.commit()
        conn.close()

    @staticmethod
    def get_by_wallet(wallet_id):
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, wallet_id, network, token, type, amount, description, date FROM transactions WHERE wallet_id=?", (wallet_id,))
        transactions = []
        for row in cursor.fetchall():
            transactions.append(Transaction(id=row[0], wallet_id=row[1], network=row[2], token=row[3], type=row[4], amount=row[5], description=row[6], date=row[7]))
        conn.close()
        return transactions

    @staticmethod
    def get_all():
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, wallet_id, network, token, type, amount, description, date FROM transactions")
        transactions = []
        for row in cursor.fetchall():
            transactions.append(Transaction(id=row[0], wallet_id=row[1], network=row[2], token=row[3], type=row[4], amount=row[5], description=row[6], date=row[7]))
        conn.close()
        return transactions

