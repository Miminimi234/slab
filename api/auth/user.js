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
    // For static deployment, return mock user data
    const mockUser = {
      id: "dev-user-123",
      email: "dev@example.com",
      firstName: "Dev",
      lastName: "User",
      profileImageUrl: "https://via.placeholder.com/150",
      wallet: {
        publicKey: "HLLkRefi3o1waTpcA9SevKD771R6sexTqKQpAag8RTsQ",
        balance: "0"
      }
    };

    res.status(200).json(mockUser);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
