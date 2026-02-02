from flask import Flask, render_template_string, jsonify, Response
from pykrx import stock
import pandas as pd
from datetime import datetime
import io

app = Flask(__name__)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>한국 주식 종목 리스트</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
        }
        .controls {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
        }
        button {
            padding: 12px 24px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }
        .btn-primary {
            background: #2a5298;
            color: white;
        }
        .btn-primary:hover {
            background: #1e3c72;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #218838;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        select {
            padding: 12px 20px;
            font-size: 16px;
            border: 2px solid #ddd;
            border-radius: 8px;
            background: white;
        }
        input[type="text"] {
            padding: 12px 20px;
            font-size: 16px;
            border: 2px solid #ddd;
            border-radius: 8px;
            width: 200px;
        }
        .stats {
            background: white;
            padding: 15px 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            gap: 30px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .stat-item {
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #2a5298;
        }
        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }
        .table-container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            background: #2a5298;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .market-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .kospi {
            background: #e3f2fd;
            color: #1976d2;
        }
        .kosdaq {
            background: #fce4ec;
            color: #c2185b;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #2a5298;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>한국 주식 종목 리스트</h1>

        <div class="controls">
            <button class="btn-primary" onclick="fetchStocks()">종목 불러오기</button>
            <select id="marketFilter" onchange="filterTable()">
                <option value="all">전체 시장</option>
                <option value="KOSPI">KOSPI</option>
                <option value="KOSDAQ">KOSDAQ</option>
            </select>
            <input type="text" id="searchInput" placeholder="종목명 검색..." oninput="filterTable()">
            <button class="btn-success" onclick="downloadExcel()" id="downloadBtn" disabled>엑셀 다운로드</button>
        </div>

        <div class="stats" id="stats" style="display: none;">
            <div class="stat-item">
                <div class="stat-value" id="totalCount">0</div>
                <div class="stat-label">전체 종목</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="kospiCount">0</div>
                <div class="stat-label">KOSPI</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="kosdaqCount">0</div>
                <div class="stat-label">KOSDAQ</div>
            </div>
        </div>

        <div class="table-container">
            <div id="loading" class="loading" style="display: none;">
                <div class="spinner"></div>
                <p>종목 데이터를 불러오는 중입니다...</p>
                <p style="font-size: 0.9rem; color: #999; margin-top: 10px;">최초 로딩 시 시간이 걸릴 수 있습니다.</p>
            </div>
            <div id="error" class="error" style="display: none;"></div>
            <table id="stockTable" style="display: none;">
                <thead>
                    <tr>
                        <th>번호</th>
                        <th>종목코드</th>
                        <th>종목명</th>
                        <th>시장</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                </tbody>
            </table>
        </div>
    </div>

    <script>
        let allStocks = [];

        async function fetchStocks() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('stockTable').style.display = 'none';
            document.getElementById('error').style.display = 'none';
            document.getElementById('stats').style.display = 'none';

            try {
                const response = await fetch('/api/stocks');
                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                allStocks = data.stocks;
                document.getElementById('totalCount').textContent = data.total;
                document.getElementById('kospiCount').textContent = data.kospi_count;
                document.getElementById('kosdaqCount').textContent = data.kosdaq_count;

                document.getElementById('stats').style.display = 'flex';
                document.getElementById('downloadBtn').disabled = false;

                renderTable(allStocks);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('stockTable').style.display = 'table';
            } catch (error) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = '데이터를 불러오는 중 오류가 발생했습니다: ' + error.message;
            }
        }

        function renderTable(stocks) {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = stocks.map((stock, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${stock.code}</td>
                    <td>${stock.name}</td>
                    <td><span class="market-badge ${stock.market.toLowerCase()}">${stock.market}</span></td>
                </tr>
            `).join('');
        }

        function filterTable() {
            const market = document.getElementById('marketFilter').value;
            const search = document.getElementById('searchInput').value.toLowerCase();

            let filtered = allStocks.filter(stock => {
                const marketMatch = market === 'all' || stock.market === market;
                const searchMatch = stock.name.toLowerCase().includes(search) ||
                                   stock.code.includes(search);
                return marketMatch && searchMatch;
            });

            renderTable(filtered);
        }

        function downloadExcel() {
            window.location.href = '/api/download';
        }
    </script>
</body>
</html>
'''

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/stocks')
def get_stocks():
    try:
        stocks = []

        # KOSPI
        kospi_tickers = stock.get_market_ticker_list(market="KOSPI")
        for ticker in kospi_tickers:
            name = stock.get_market_ticker_name(ticker)
            stocks.append({
                "code": ticker,
                "name": name,
                "market": "KOSPI"
            })

        kospi_count = len(kospi_tickers)

        # KOSDAQ
        kosdaq_tickers = stock.get_market_ticker_list(market="KOSDAQ")
        for ticker in kosdaq_tickers:
            name = stock.get_market_ticker_name(ticker)
            stocks.append({
                "code": ticker,
                "name": name,
                "market": "KOSDAQ"
            })

        kosdaq_count = len(kosdaq_tickers)

        return jsonify({
            "stocks": stocks,
            "total": len(stocks),
            "kospi_count": kospi_count,
            "kosdaq_count": kosdaq_count
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download')
def download_excel():
    try:
        stocks = []

        # KOSPI
        kospi_tickers = stock.get_market_ticker_list(market="KOSPI")
        for ticker in kospi_tickers:
            name = stock.get_market_ticker_name(ticker)
            stocks.append({
                "종목코드": ticker,
                "종목명": name,
                "시장": "KOSPI"
            })

        # KOSDAQ
        kosdaq_tickers = stock.get_market_ticker_list(market="KOSDAQ")
        for ticker in kosdaq_tickers:
            name = stock.get_market_ticker_name(ticker)
            stocks.append({
                "종목코드": ticker,
                "종목명": name,
                "시장": "KOSDAQ"
            })

        df = pd.DataFrame(stocks)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='전체종목', index=False)
            df[df['시장'] == 'KOSPI'].to_excel(writer, sheet_name='KOSPI', index=False)
            df[df['시장'] == 'KOSDAQ'].to_excel(writer, sheet_name='KOSDAQ', index=False)

        output.seek(0)

        today = datetime.now().strftime("%Y%m%d")
        filename = f"korean_stocks_{today}.xlsx"

        return Response(
            output.getvalue(),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Vercel serverless handler
app = app
