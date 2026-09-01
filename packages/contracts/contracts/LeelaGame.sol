// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LeelaGame {
  uint8 constant MAX_ROLL = 6;
  uint8 constant WIN_PLAN = 68;
  uint8 constant TOTAL_PLANS = 72;

  enum Action {
    Created,
    Updated,
    Deleted
  }

  struct Player {
    string fullName;
    string avatar;
    string intention;
    uint256 plan;
    uint256 previousPlan;
    bool isStart;
    bool isFinished;
    uint8 consecutiveSixes;
    uint256 positionBeforeThreeSixes;
  }

  struct Comment {
    uint256 commentId;
    uint256 reportId;
    string avatar;
    string fullName;
    uint256 plan;
    address commenter;
    string content;
    uint256 timestamp;
  }

  struct Report {
    uint256 reportId;
    address reporter;
    string avatar;
    string fullName;
    string content;
    uint256 plan;
    uint256 timestamp;
    uint256[] commentIds;
    uint256 likes;
  }

  uint256 private playerIdCounter;
  uint256 private reportIdCounter;
  uint256 private commentIdCounter;

  mapping(address => bool) public playerCreated;
  mapping(address => Player) public players;
  mapping(address => uint8[]) public playerRolls;
  mapping(address => uint256[]) public playerPlans;
  mapping(address => bool) public playerReportCreated;

  mapping(uint256 => Report) public reports;
  mapping(uint256 => Comment) public comments;

  constructor() {
    Player memory newPlayer;
    newPlayer.plan = 68;
    newPlayer.previousPlan = 68;
    players[msg.sender] = newPlayer;
  }

  event PlayerAction(
    address indexed player,
    string fullName,
    string avatar,
    string intention,
    Action action
  );

  event DiceRolled(
    address indexed roller,
    uint8 indexed rolled,
    uint256 indexed currentPlan
  );

  event ReportAction(
    uint256 indexed reportId,
    address indexed actor,
    string avatar,
    string fullName,
    string content,
    uint256 plan,
    uint256 timestamp,
    Action action
  );

  event CommentAction(
    uint256 indexed commentId,
    uint256 indexed reportId,
    address indexed actor,
    string avatar,
    string fullName,
    uint256 plan,
    string content,
    uint256 timestamp,
    Action action
  );

  event ReportLiked(uint256 indexed reportId, bool like, uint256 likes);

  function createOrUpdateOrDeletePlayer(
    string memory _fullName,
    string memory _avatar,
    string memory _intention,
    Action action
  ) external {
    Player storage player = players[msg.sender];

    if (action == Action.Created) {
      require(!playerCreated[msg.sender], 'Player already exists');
      player.fullName = _fullName;
      player.avatar = _avatar;
      player.intention = _intention;
      player.plan = 0;
      playerCreated[msg.sender] = true;
      emit PlayerAction(
        msg.sender,
        _fullName,
        _avatar,
        _intention,
        Action.Created
      );
    } else if (action == Action.Updated) {
      require(playerCreated[msg.sender], 'Player does not exist');
      player.fullName = _fullName;
      player.avatar = _avatar;
      player.intention = _intention;
      emit PlayerAction(
        msg.sender,
        _fullName,
        _avatar,
        _intention,
        Action.Updated
      );
    } else if (action == Action.Deleted) {
      require(playerCreated[msg.sender], 'Player does not exist');
      delete players[msg.sender];
      delete playerCreated[msg.sender];
      emit PlayerAction(msg.sender, '', '', '', Action.Deleted);
    }
  }

  function rollDice(uint8 rollResult) external {
    require(
      playerCreated[msg.sender],
      'Player must be created before rolling the dice'
    );

    require(
      rollResult >= 1 && rollResult <= MAX_ROLL,
      'Invalid roll result: rollResult >= 1 && rollResult <= MAX_ROLL'
    );

    Player storage player = players[msg.sender];

    playerRolls[msg.sender].push(rollResult);

    if (player.isStart) {
      require(
        reports[reportIdCounter].reporter == msg.sender,
        'You must create a report before rolling the dice.'
      );
    }

    if (!player.isStart && rollResult == 6) {
      player.plan = 6;
      player.isStart = true;
      player.consecutiveSixes = 1;
      playerPlans[msg.sender].push(6);
      emit DiceRolled(msg.sender, rollResult, 6);
    } else if (player.isStart) {
      handleRollResult(rollResult, msg.sender);
    }
  }

  function handleRollResult(uint8 roll, address playerAddress) private {
    Player storage player = players[playerAddress];

    playerReportCreated[msg.sender] = false;

    if (roll == MAX_ROLL) {
      player.positionBeforeThreeSixes = player.plan;
      player.consecutiveSixes += 1;
      if (player.consecutiveSixes == 3) {
        player.plan = player.positionBeforeThreeSixes;
        player.consecutiveSixes = 0;
        return;
      }
    } else {
      player.consecutiveSixes = 0;
    }

    movePlayer(roll, playerAddress);
  }

  function movePlayer(uint8 roll, address playerAddress) private {
    Player storage player = players[playerAddress];
    player.previousPlan = player.plan;
    uint256 newPlan = player.plan + roll;

    // Snakes that lead the player downwards
    if (newPlan > TOTAL_PLANS) {
      newPlan = player.plan;
    }
    if (newPlan == 12) {
      newPlan = 8;
    } else if (newPlan == 16) {
      newPlan = 4;
    } else if (newPlan == 24) {
      newPlan = 7;
    } else if (newPlan == 29) {
      newPlan = 6;
    } else if (newPlan == 44) {
      newPlan = 9;
    } else if (newPlan == 52) {
      newPlan = 35;
    } else if (newPlan == 55) {
      newPlan = 3;
    } else if (newPlan == 61) {
      newPlan = 13;
    } else if (newPlan == 63) {
      newPlan = 2;
    } else if (newPlan == 72) {
      newPlan = 51;
    }
    // Arrows that lead the player upwards
    else if (newPlan == 10) {
      newPlan = 23;
    } else if (newPlan == 17) {
      newPlan = 69;
    } else if (newPlan == 20) {
      newPlan = 32;
    } else if (newPlan == 22) {
      newPlan = 60;
    } else if (newPlan == 27) {
      newPlan = 41;
    } else if (newPlan == 28) {
      newPlan = 50;
    } else if (newPlan == 37) {
      newPlan = 66;
    } else if (newPlan == 45) {
      newPlan = 67;
    } else if (newPlan == 46) {
      newPlan = 62;
    } else if (newPlan == 54) {
      newPlan = 68;
    } else if (newPlan > TOTAL_PLANS) {
      // Player overshoots the goal, stays in place
      newPlan = player.plan;
    }

    player.plan = newPlan;
    playerPlans[playerAddress].push(newPlan);

    // Check for finish
    if (newPlan == WIN_PLAN) {
      player.isFinished = true;
      player.previousPlan = newPlan;
      player.isStart = false;
    }
    emit DiceRolled(playerAddress, roll, newPlan);
  }

  function getPlayer(
    address playerAddress
  ) external view returns (Player memory) {
    require(
      playerCreated[playerAddress],
      'Player must be created before accessing player data'
    );
    return players[playerAddress];
  }

  function getRollHistory(address player) public view returns (uint8[] memory) {
    return playerRolls[player];
  }

  function checkGameStatus(
    address playerAddress
  ) public view returns (bool isStart, bool isFinished) {
    Player storage player = players[playerAddress];
    return (player.isStart, player.isFinished);
  }

  function getPlanHistory(
    address player
  ) public view returns (uint256[] memory) {
    return playerPlans[player];
  }

  function createReport(string memory content) external {
    uint256 currentPlan = players[msg.sender].plan;
    require(
      players[msg.sender].isStart,
      'You must start the game before creating a report.'
    );

    reportIdCounter++;

    reports[reportIdCounter] = Report({
      reportId: reportIdCounter,
      reporter: msg.sender,
      avatar: players[msg.sender].avatar,
      fullName: players[msg.sender].fullName,
      content: content,
      plan: currentPlan,
      timestamp: block.timestamp,
      commentIds: new uint256[](0),
      likes: 0
    });

    playerReportCreated[msg.sender] = true;

    emit ReportAction(
      reportIdCounter,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      content,
      currentPlan,
      block.timestamp,
      Action.Created
    );
  }

  function updateReportContent(
    uint256 reportId,
    string memory newContent
  ) external {
    Report storage report = reports[reportId];
    require(
      report.reporter == msg.sender,
      'Only the reporter can update the report.'
    );
    report.content = newContent;

    emit ReportAction(
      reportId,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      newContent,
      report.plan,
      block.timestamp,
      Action.Updated
    );
  }

  function deleteReport(uint256 reportId) external {
    require(reportId <= reportIdCounter && reportId > 0, 'Invalid report ID.');
    Report storage report = reports[reportId];
    require(
      report.reporter == msg.sender,
      'Only the reporter can delete the report.'
    );
    report.content = 'This report has been deleted.';

    emit ReportAction(
      reportId,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      'This report has been deleted.',
      report.plan,
      block.timestamp,
      Action.Deleted
    );
  }

  function getAllReports() external view returns (Report[] memory) {
    Report[] memory allReports = new Report[](reportIdCounter);
    for (uint256 i = 1; i <= reportIdCounter; i++) {
      allReports[i - 1] = reports[i];
    }
    return allReports;
  }

  function getReport(uint256 reportId) external view returns (Report memory) {
    require(reportId <= reportIdCounter && reportId > 0, 'Invalid report ID.');
    return reports[reportId];
  }

  function getAllCommentsForReport(
    uint256 reportId
  ) external view returns (Comment[] memory) {
    Report storage report = reports[reportId];
    uint256[] storage commentIds = report.commentIds;

    Comment[] memory allComments = new Comment[](commentIds.length);

    for (uint256 i = 0; i < commentIds.length; i++) {
      allComments[i] = comments[commentIds[i]];
    }

    return allComments;
  }

  function addComment(uint256 reportId, string memory content) external {
    Report storage report = reports[reportId];
    require(report.reporter != address(0), 'Report does not exist.');

    commentIdCounter++;

    comments[commentIdCounter] = Comment({
      commentId: commentIdCounter,
      reportId: reportId,
      commenter: msg.sender,
      avatar: players[msg.sender].avatar,
      fullName: players[msg.sender].fullName,
      plan: players[msg.sender].plan,
      content: content,
      timestamp: block.timestamp
    });

    report.commentIds.push(commentIdCounter);

    emit CommentAction(
      commentIdCounter,
      reportId,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      players[msg.sender].plan,
      content,
      block.timestamp,
      Action.Created
    );
  }

  function updateCommentContent(
    uint256 commentId,
    string memory newContent
  ) external {
    Comment storage comment = comments[commentId];
    require(
      comment.commenter == msg.sender,
      'Only the commenter can update the comment.'
    );

    comment.content = newContent;

    emit CommentAction(
      commentId,
      comment.reportId,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      players[msg.sender].plan,
      newContent,
      block.timestamp,
      Action.Updated
    );
  }

  function deleteComment(uint256 commentId) external {
    Comment storage comment = comments[commentId];
    require(
      comment.commenter == msg.sender,
      'Only the commenter can delete the comment.'
    );

    delete comments[commentId];

    // Remove the commentId from the commentIds array in the corresponding report
    uint256[] storage reportCommentIds = reports[comment.reportId].commentIds;
    for (uint256 i = 0; i < reportCommentIds.length; i++) {
      if (reportCommentIds[i] == commentId) {
        reportCommentIds[i] = reportCommentIds[reportCommentIds.length - 1];
        reportCommentIds.pop();
        break;
      }
    }

    emit CommentAction(
      commentId,
      comment.reportId,
      msg.sender,
      players[msg.sender].avatar,
      players[msg.sender].fullName,
      players[msg.sender].plan,
      comment.content,
      block.timestamp,
      Action.Deleted
    );
  }

  function toggleLikeReport(
    uint256 reportId,
    bool like
  ) external returns (uint256) {
    Report storage report = reports[reportId];

    if (like) {
      report.likes++;
      emit ReportLiked(reportId, like, report.likes);
      return report.likes;
    } else {
      require(report.likes > 0, 'Report has no likes.');
      report.likes--;
      emit ReportLiked(reportId, like, report.likes);
      return report.likes;
    }
  }
}
