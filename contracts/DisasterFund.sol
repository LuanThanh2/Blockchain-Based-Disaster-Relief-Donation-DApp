// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DisasterFund {
    struct Campaign {
        address payable owner;
        string title;
        string description;
        uint256 goal;
        uint256 raised;
        uint256 withdrawn;
        bool active;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) private _campaigns;

    event CampaignCreated(uint256 indexed campaignId, address indexed owner, uint256 goal, string title);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, address indexed owner, uint256 amount);

    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal
    ) external returns (uint256 campaignId) {
        require(goal > 0, "goal must be > 0");

        campaignId = ++campaignCount;
        _campaigns[campaignId] = Campaign({
            owner: payable(msg.sender),
            title: title,
            description: description,
            goal: goal,
            raised: 0,
            withdrawn: 0,
            active: true
        });

        emit CampaignCreated(campaignId, msg.sender, goal, title);
    }

    function getCampaign(uint256 campaignId)
        external
        view
        returns (
            address owner,
            string memory title,
            string memory description,
            uint256 goal,
            uint256 raised,
            uint256 withdrawn,
            bool active
        )
    {
        Campaign storage c = _campaigns[campaignId];
        require(c.owner != address(0), "campaign not found");
        return (c.owner, c.title, c.description, c.goal, c.raised, c.withdrawn, c.active);
    }

    function donate(uint256 campaignId) external payable {
        require(msg.value > 0, "amount must be > 0");
        Campaign storage c = _campaigns[campaignId];
        require(c.owner != address(0), "campaign not found");
        require(c.active, "campaign inactive");

        c.raised += msg.value;
        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function withdraw(uint256 campaignId, uint256 amount) external {
        require(amount > 0, "amount must be > 0");
        Campaign storage c = _campaigns[campaignId];
        require(c.owner != address(0), "campaign not found");
        require(msg.sender == c.owner, "not campaign owner");

        uint256 available = c.raised - c.withdrawn;
        require(amount <= available, "insufficient available funds");

        c.withdrawn += amount;
        (bool ok, ) = c.owner.call{value: amount}("");
        require(ok, "transfer failed");

        emit FundsWithdrawn(campaignId, c.owner, amount);
    }

    function setActive(uint256 campaignId, bool active) external {
        Campaign storage c = _campaigns[campaignId];
        require(c.owner != address(0), "campaign not found");
        require(msg.sender == c.owner, "not campaign owner");
        c.active = active;
    }
}
