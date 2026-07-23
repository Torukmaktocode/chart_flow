import requests
import json
import sys

def fetch_exchange_rates(base_currency="USD"):
    """
    Fetch exchange rates using ExchangeRate-API Open Access (no key required)
    """
    try:
        url = f"https://open.er-api.com/v6/latest/{base_currency}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("result") == "success":
            return data
        else:
            print(f"API error: {data.get('error-type', 'Unknown error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None

def display_rates(data, target_currencies=None):
    """
    Display exchange rates in a formatted way
    """
    if not data:
        return
    
    print(f"\nExchange Rates (Base: {data['base_code']})")
    print(f"Last Updated: {data['time_last_update_utc']}")
    print("-" * 50)
    
    rates = data["rates"]
    
    if target_currencies:
        # Filter to show only requested currencies
        filtered_rates = {k: v for k, v in rates.items() if k in target_currencies}
        rates = filtered_rates
    
    for currency, rate in sorted(rates.items()):
        print(f"{currency}: {rate:.6f}")

def main():
    # Default to USD as base currency
    base_currency = "USD"
    
    # Common currencies to display
    target_currencies = ["EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "MXN"]
    
    print("Fetching exchange rates...")
    data = fetch_exchange_rates(base_currency)
    
    if data:
        display_rates(data, target_currencies)
        
        # Also show all available currencies if no specific ones requested
        if len(sys.argv) > 1 and sys.argv[1] == "--all":
            display_rates(data)
    else:
        print("Failed to fetch exchange rates. Please check your internet connection.")

if __name__ == "__main__":
    main()