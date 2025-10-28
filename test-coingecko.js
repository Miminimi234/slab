// Test script for CoinGecko API only
async function testCoinGeckoAPI() {
    console.log('Testing CoinGecko API...');

    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', {
            headers: {
                'User-Agent': 'SLAB-Trading-Platform/1.0',
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
            const data = await response.json();
            console.log('CoinGecko Response:', JSON.stringify(data, null, 2));

            console.log('\nParsed Prices from CoinGecko:');
            if (data.bitcoin) {
                console.log(`BTC: $${data.bitcoin.usd} (${data.bitcoin.usd_24h_change >= 0 ? '+' : ''}${data.bitcoin.usd_24h_change?.toFixed(2) || 0}%)`);
            }
            if (data.ethereum) {
                console.log(`ETH: $${data.ethereum.usd} (${data.ethereum.usd_24h_change >= 0 ? '+' : ''}${data.ethereum.usd_24h_change?.toFixed(2) || 0}%)`);
            }
            if (data.solana) {
                console.log(`SOL: $${data.solana.usd} (${data.solana.usd_24h_change >= 0 ? '+' : ''}${data.solana.usd_24h_change?.toFixed(2) || 0}%)`);
            }
        } else {
            const errorText = await response.text();
            console.error('CoinGecko API Error:', response.status, errorText);
        }
    } catch (error) {
        console.error('CoinGecko API error:', error);
    }
}

// Test alternative TradingView approach
async function testAlternativeTradingView() {
    console.log('\nTesting alternative TradingView approach...');

    // Try a simpler request structure
    const payload = {
        filter: [],
        options: {
            lang: 'en'
        },
        symbols: {
            tickers: [
                'BINANCE:BTCUSDT',
                'BINANCE:ETHUSDT',
                'BINANCE:SOLUSDT'
            ]
        },
        columns: ['name', 'close', 'change'],
        sort: {
            sortBy: 'name',
            sortOrder: 'asc'
        },
        range: [0, 10]
    };

    try {
        const response = await fetch('https://scanner.tradingview.com/crypto/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Alternative TradingView Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Alternative TradingView Response:', JSON.stringify(data, null, 2));
        } else {
            const errorText = await response.text();
            console.error('Alternative TradingView Error:', errorText);
        }
    } catch (error) {
        console.error('Alternative TradingView error:', error);
    }
}

// Run both tests
testCoinGeckoAPI().then(() => testAlternativeTradingView());