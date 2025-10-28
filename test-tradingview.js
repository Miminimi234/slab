// Test script for TradingView API
async function testTradingViewAPI() {
    console.log('Testing TradingView API...');

    const SYMBOLS = {
        BTC: 'BINANCE:BTCUSDT',
        ETH: 'BINANCE:ETHUSDT',
        SOL: 'BINANCE:SOLUSDT'
    };

    const payload = {
        filter: [
            {
                left: 'name',
                operation: 'in_range',
                right: Object.values(SYMBOLS)
            }
        ],
        options: {
            lang: 'en'
        },
        symbols: {
            query: {
                types: []
            },
            tickers: Object.values(SYMBOLS)
        },
        columns: [
            'name',
            'close',
            'change'
        ],
        sort: {
            sortBy: 'name',
            sortOrder: 'asc'
        },
        range: [0, 100]
    };

    try {
        console.log('Sending request to TradingView API...');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch('https://scanner.tradingview.com/crypto/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Origin': 'https://www.tradingview.com',
                'Referer': 'https://www.tradingview.com/'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`TradingView API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));

        if (data.data && Array.isArray(data.data)) {
            console.log('\nParsed Prices:');
            data.data.forEach((item, index) => {
                const [symbolName, price, change24h] = item.d || [];

                // Map TradingView symbol back to our symbol
                const symbol = Object.keys(SYMBOLS).find(
                    key => SYMBOLS[key] === symbolName
                );

                console.log(`${index + 1}. ${symbolName} (${symbol}): $${price} (${change24h >= 0 ? '+' : ''}${change24h}%)`);
            });
        } else {
            console.error('Unexpected response format:', data);
        }

    } catch (error) {
        console.error('Error testing TradingView API:', error);

        // Test fallback API
        console.log('\nTesting fallback CoinGecko API...');
        try {
            const fallbackResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', {
                headers: {
                    'User-Agent': 'SLAB-Trading-Platform/1.0'
                }
            });

            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('CoinGecko Response:', JSON.stringify(fallbackData, null, 2));

                console.log('\nParsed Prices from CoinGecko:');
                if (fallbackData.bitcoin) {
                    console.log(`BTC: $${fallbackData.bitcoin.usd} (${fallbackData.bitcoin.usd_24h_change >= 0 ? '+' : ''}${fallbackData.bitcoin.usd_24h_change?.toFixed(2) || 0}%)`);
                }
                if (fallbackData.ethereum) {
                    console.log(`ETH: $${fallbackData.ethereum.usd} (${fallbackData.ethereum.usd_24h_change >= 0 ? '+' : ''}${fallbackData.ethereum.usd_24h_change?.toFixed(2) || 0}%)`);
                }
                if (fallbackData.solana) {
                    console.log(`SOL: $${fallbackData.solana.usd} (${fallbackData.solana.usd_24h_change >= 0 ? '+' : ''}${fallbackData.solana.usd_24h_change?.toFixed(2) || 0}%)`);
                }
            } else {
                console.error('CoinGecko API also failed:', fallbackResponse.status);
            }
        } catch (fallbackError) {
            console.error('CoinGecko API error:', fallbackError);
        }
    }
}

// Run the test
testTradingViewAPI();