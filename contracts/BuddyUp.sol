// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BuddyUp
/// @notice Post a "looking for buddies" card, set the spots, let people join until it's full.
///         No tokens, no payments, no admin. Contact details stay off-chain except an optional public handle.
contract BuddyUp {
    enum Category { Hackathon, Study, Active, Hangout, Other }

    struct Post {
        address host;
        string title;
        string description;
        Category category;
        string area;
        string contact;
        uint8 spots;
        uint8 filled;
        uint64 when;
        bool closed;
        uint64 createdAt;
    }

    uint256 public constant MAX_SPOTS = 20;

    Post[] public posts;
    mapping(uint256 => mapping(address => bool)) public joined;
    mapping(uint256 => address[]) private members;
    mapping(address => uint256[]) private hosting;
    mapping(address => uint256[]) private joinedPosts;

    uint256 private totalJoins; // seats currently filled across all posts
    uint256 private fullPosts;  // posts that are currently full

    event PostCreated(uint256 indexed id, address indexed host, Category category, uint8 spots);
    event Joined(uint256 indexed id, address indexed member, uint8 filled);
    event Left(uint256 indexed id, address indexed member, uint8 filled);
    event Closed(uint256 indexed id);
    event Full(uint256 indexed id);

    // ---------------------------------------------------------------- write

    function createPost(
        string calldata title,
        string calldata description,
        Category category,
        string calldata area,
        string calldata contact,
        uint8 spots,
        uint64 when
    ) external returns (uint256 id) {
        require(bytes(title).length > 0 && bytes(title).length <= 80, "Title");
        require(bytes(description).length <= 400, "Description");
        require(bytes(area).length > 0 && bytes(area).length <= 60, "Area");
        require(bytes(contact).length <= 40, "Contact");
        require(spots >= 1 && spots <= MAX_SPOTS, "Spots");
        require(when > block.timestamp, "Date");
        require(uint8(category) <= uint8(Category.Other), "Category");

        id = posts.length;
        posts.push(Post({
            host: msg.sender,
            title: title,
            description: description,
            category: category,
            area: area,
            contact: contact,
            spots: spots,
            filled: 0,
            when: when,
            closed: false,
            createdAt: uint64(block.timestamp)
        }));
        hosting[msg.sender].push(id);
        emit PostCreated(id, msg.sender, category, spots);
    }

    function join(uint256 id) external {
        require(id < posts.length, "Missing");
        Post storage p = posts[id];
        require(msg.sender != p.host, "Host");
        require(!joined[id][msg.sender], "Joined");
        require(!p.closed, "Closed");
        require(block.timestamp < p.when, "Ended");
        require(p.filled < p.spots, "Full");

        joined[id][msg.sender] = true;
        members[id].push(msg.sender);
        joinedPosts[msg.sender].push(id);
        p.filled += 1;
        totalJoins += 1;
        emit Joined(id, msg.sender, p.filled);

        if (p.filled == p.spots) {
            fullPosts += 1;
            emit Full(id);
        }
    }

    function leave(uint256 id) external {
        require(id < posts.length, "Missing");
        Post storage p = posts[id];
        require(joined[id][msg.sender], "NotJoined");
        require(block.timestamp < p.when, "Ended");

        bool wasFull = p.filled == p.spots;
        joined[id][msg.sender] = false;
        _remove(members[id], msg.sender);
        _removeId(joinedPosts[msg.sender], id);
        p.filled -= 1;
        totalJoins -= 1;
        if (wasFull) fullPosts -= 1;
        emit Left(id, msg.sender, p.filled);
    }

    function close(uint256 id) external {
        require(id < posts.length, "Missing");
        Post storage p = posts[id];
        require(msg.sender == p.host, "NotHost");
        require(!p.closed, "Closed");
        p.closed = true;
        emit Closed(id);
    }

    // ----------------------------------------------------------------- read

    function getPost(uint256 id) external view returns (Post memory) {
        require(id < posts.length, "Missing");
        return posts[id];
    }

    function getMembers(uint256 id) external view returns (address[] memory) {
        return members[id];
    }

    /// @notice Page through posts in creation order.
    function getPosts(uint256 from, uint256 count) external view returns (Post[] memory out) {
        uint256 total = posts.length;
        if (from >= total) return new Post[](0);
        uint256 end = from + count;
        if (end > total) end = total;
        out = new Post[](end - from);
        for (uint256 i = from; i < end; i++) out[i - from] = posts[i];
    }

    function hostingOf(address who) external view returns (uint256[] memory) {
        return hosting[who];
    }

    function joinedOf(address who) external view returns (uint256[] memory) {
        return joinedPosts[who];
    }

    function stats() external view returns (uint256 totalPosts, uint256 joins, uint256 full) {
        return (posts.length, totalJoins, fullPosts);
    }

    // ------------------------------------------------------------- internal

    function _remove(address[] storage list, address who) private {
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == who) {
                list[i] = list[n - 1];
                list.pop();
                return;
            }
        }
    }

    function _removeId(uint256[] storage list, uint256 id) private {
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == id) {
                list[i] = list[n - 1];
                list.pop();
                return;
            }
        }
    }
}
