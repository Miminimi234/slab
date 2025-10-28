// Test the price API endpoint
async function testPriceAPI() {
    console.log('Testing price API endpoint...');

    try {
        // Test the main prices endpoint
        const response = await fetch('http://localhost:5000/api/prices', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
            const data = await response.json();
            console.log('Price API Response:', JSON.stringify(data, null, 2));

            // Verify the structure matches what frontend expects
            if (data.success && data.data) {
                console.log('\n✓ Response has correct structure (success: true, data: object)');

                // Check each symbol
                const expectedSymbols = ['BTC', 'ETH', 'SOL'];
                expectedSymbols.forEach(symbol => {
                    if (data.data[symbol]) {
                        const priceData = data.data[symbol];
                        console.log(`✓ ${symbol} data:`, {
                            symbol: priceData.symbol,
                            price: priceData.price,
                            change24h: priceData.change24h,
                            timestamp: priceData.timestamp,
                            age: new Date(Date.now() - priceData.timestamp).toISOString()
                        });
                    } else {
                        console.log(`✗ Missing ${symbol} data`);
                    }
                });
            } else {
                console.log('✗ Response structure is incorrect');
            }
        } else {
            const errorText = await response.text();
            console.error('Price API Error:', response.status, errorText);
        }

        // Test individual symbol endpoint
        console.log('\n--- Testing individual symbol endpoint ---');
        const btcResponse = await fetch('http://localhost:5000/api/prices/BTC', {
            credentials: 'include'
        });

        if (btcResponse.ok) {
            const btcData = await btcResponse.json();
            console.log('BTC API Response:', JSON.stringify(btcData, null, 2));
        } else {
            console.error('BTC API Error:', btcResponse.status);
        }

    } catch (error) {
        console.error('Error testing price API:', error);
    }
}

// Test if server is running
async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:5000/api/prices/status');
        if (response.ok) {
            const status = await response.json();
            console.log('Price Service Status:', JSON.stringify(status, null, 2));
        } else {
            console.log('Server not running or price service not available');
        }
    } catch (error) {
        console.log('Server not reachable:', error.message);
    }
}

// Run tests
checkServerStatus().then(() => testPriceAPI());