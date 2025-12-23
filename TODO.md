# TODO List for Frontend Implementation

## 1. Install ethers.js
- Navigate to Frontend directory
- Run npm install ethers

## 2. Create Donate UI Page
- Create Frontend/app/user/donate/page.tsx
- Implement MetaMask connection
- Add form to input donation amount and campaign ID
- Integrate ethers.js to call donate(campaignId) on the contract
- Handle transaction signing and submission

## 3. Update Reliefs List Page (Frontend/app/reliefs/page.tsx)
- Add progress display for each campaign (raised vs target)
- Add "Donate" link/button for each campaign
- Link to the new donate page with campaign ID

## 4. Update Reliefs Detail Page (Frontend/app/reliefs/[slug]/page.tsx)
- Add progress display (raised vs target)
- Add "Donate" button linking to donate page with campaign ID
- Ensure onchain_id is used for donations

## 5. Test Integration
- Verify MetaMask connection works
- Test donation transaction
- Check progress updates
