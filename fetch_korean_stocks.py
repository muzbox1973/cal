#!/usr/bin/env python3
"""
한국 주식 종목 리스트 엑셀 생성기
KOSPI, KOSDAQ 종목 코드와 종목명을 엑셀 파일로 저장합니다.
"""

from pykrx import stock
import pandas as pd
from datetime import datetime


def fetch_stock_tickers():
    """KOSPI, KOSDAQ 종목 리스트를 가져와서 엑셀로 저장"""

    print("KOSPI 종목 리스트 가져오는 중...")
    kospi_tickers = stock.get_market_ticker_list(market="KOSPI")
    kospi_data = []
    for ticker in kospi_tickers:
        name = stock.get_market_ticker_name(ticker)
        kospi_data.append({
            "종목코드": ticker,
            "종목명": name,
            "시장": "KOSPI"
        })
    print(f"KOSPI: {len(kospi_tickers)}개 종목")

    print("KOSDAQ 종목 리스트 가져오는 중...")
    kosdaq_tickers = stock.get_market_ticker_list(market="KOSDAQ")
    kosdaq_data = []
    for ticker in kosdaq_tickers:
        name = stock.get_market_ticker_name(ticker)
        kosdaq_data.append({
            "종목코드": ticker,
            "종목명": name,
            "시장": "KOSDAQ"
        })
    print(f"KOSDAQ: {len(kosdaq_tickers)}개 종목")

    # DataFrame 생성
    df_kospi = pd.DataFrame(kospi_data)
    df_kosdaq = pd.DataFrame(kosdaq_data)
    df_all = pd.DataFrame(kospi_data + kosdaq_data)

    # 엑셀 파일 생성 (날짜 포함)
    today = datetime.now().strftime("%Y%m%d")
    filename = f"korean_stocks_{today}.xlsx"

    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        df_all.to_excel(writer, sheet_name='전체종목', index=False)
        df_kospi.to_excel(writer, sheet_name='KOSPI', index=False)
        df_kosdaq.to_excel(writer, sheet_name='KOSDAQ', index=False)

    print(f"\n엑셀 파일 생성 완료: {filename}")
    print(f"총 {len(df_all)}개 종목 (KOSPI: {len(df_kospi)}, KOSDAQ: {len(df_kosdaq)})")

    return filename


if __name__ == "__main__":
    fetch_stock_tickers()
