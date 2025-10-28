export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // For static deployment, return mock wallets
    const mockWallets = [
      {
        id: "wallet-1",
        name: "Main Wallet",
        publicKey: "HLLkRefi3o1waTpcA9SevKD771R6sexTqKQpAag8RTsQ",
        balance: "0.5",
        isPrimary: "true",
        isArchived: "false",
        createdAt: new Date().toISOString()
      },
      {
        id: "wallet-2", 
        name: "Trading Wallet",
        publicKey: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        balance: "1.2",
        isPrimary: "false",
        isArchived: "false",
        createdAt: new Date().toISOString()
      }
    ];

    res.status(200).json(mockWallets);
  } else if (req.method === 'POST') {
    // Create new wallet
    const { name } = req.body;
    const newWallet = {
      id: `wallet-${Date.now()}`,
      name: name || "New Wallet",
      publicKey: "GeneratedPublicKey" + Math.random().toString(36).substr(2, 9),
      balance: "0",
      isPrimary: "false",
      isArchived: "false",
      createdAt: new Date().toISOString()
    };

    res.status(201).json(newWallet);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
