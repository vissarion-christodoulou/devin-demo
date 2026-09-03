# devin-demo
Proof of concept for 3 apps built with Devin

## 1. KYC Review Queue
This is a queue of customers that could not be cleared by the automatic KYC process. The application shows the customers first-to-last. Clicking on arrow allows a reviewsto approve/reject the KYC process. To run:

```sh
cd kyc-review-app
npm install
npm run dev
```

## 2. Refunds Dashboard
Serves static data that explains what products have been refunded by customers and why. To run:

```sh
cd refunds-dashboard
npm install
npm run dev
```

##  3. Feature Flags Admin

Controls the graphs that show up in the Refunds Dashboard through toggles. To run, you need two shells as it runs a frontend and backend:

```sh
cd feature-flags-admin/frontend
npm install
npm run dev
```

```sh
cd feature-flags-admin/backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --port 8000
```
