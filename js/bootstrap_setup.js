document.addEventListener('DOMContentLoaded', function() {
  // Initialize modals only if they exist
  const deleteModal = document.getElementById("delete-positions-modal");
  const createModal = document.getElementById("create-position-modal");
  
  const managePositionsModal = deleteModal ? new bootstrap.Modal(deleteModal) : null;
  const createPositionModal = createModal ? new bootstrap.Modal(createModal) : null;

  // Fix the button IDs to match what's actually in the HTML
  var createPositionButton = document.getElementById("create-position-btn");
  if (createPositionButton) {
    createPositionButton.addEventListener("click", requestNewPosition);
  }

  var showPositionsButton = document.getElementById("show-positions-btn");
  if (showPositionsButton) {
    showPositionsButton.addEventListener("click", toggleShowPositions);
  }

  var showDirectionsButton = document.getElementById("show-directions-btn");
  if (showDirectionsButton) {
    showDirectionsButton.addEventListener("click", toggleShowDirections);
  }

  // Make modals available globally for the functions that need them
  window.managePositionsModal = managePositionsModal;
  window.createPositionModal = createPositionModal;
});

function loadCreatePositionModal() {
    if (window.createPositionModal) {
        window.createPositionModal.show();
    }
}

function loadPositionsForRemoval() {
    if (window.managePositionsModal) {
        window.managePositionsModal.show();
    }
    var positionsContainer = document.getElementById("delete-positions-container")
    var htmlContent = "";
  
    if (savedVariables.size > 1) {
        htmlContent += '<div class="row"><p>Use the buttons below to delete the assigned positions:</p></div>';
        htmlContent += '<div class="row">';
        htmlContent += '<div id="delete-positions-list" class="list-group">';

        for (let [name, key] of savedVariables) {
            if (name != "Home") {
                htmlContent += '<a id="delete-position-value" class="list-group-item">\
                <div class="row">\
                    <div id="delete-position-name" class="col-6">' + name + '</div>\
                    <div id="delete-position-options" class="col-6">\
                        <div class="container">\
                            <div class="row">\
                                <button type="button" id="delete-position-button" value="' + name + '" class="btn btn-danger float-end">Delete</button>\
                            </div>\
                        </div>\
                    </div>\
                </div>\
              </a>'
            }
        }

        htmlContent += '</div></div>';
        positionsContainer.innerHTML = htmlContent;

        var removeButtons = document.querySelectorAll("#delete-position-button");
    
        removeButtons.forEach(removeButton => {
            removeButton.addEventListener("click", deletePosition, false);
        });    
    } else {
        htmlContent = '<div class="row"><p>No robot positions were assigned.</p></div>';
        positionsContainer.innerHTML = htmlContent;
    }
}

function requestNewPosition() {
    var positionName = document.getElementById("position-name").value;

    if (positionName !== "") {
        var currentScene = game.scene.getScene(phaserSceneName);
        var positionKey = positionName.toUpperCase();
        var positionCoordinate = currentScene.getGripperPosition();
        createNewPosition(positionName, positionKey, positionCoordinate);
    } else {
        window.alert("Position name is missing.");
    }
}

function deletePosition(event) {
    var positionName = event.currentTarget.value;
    var positionKey = savedVariables.get(positionName);
    savedVariables.delete(positionName);
    savedCoordinates.delete(positionKey);
    removeBlocksWithPosition(positionKey);

    var currentScene = game.scene.getScene(phaserSceneName);
    currentScene.drawCircles();
    currentScene.drawLabels();
    currentScene.drawArrows();

    loadPositionsForRemoval();
}

function toggleShowPositions() {
    var currentScene = game.scene.getScene(phaserSceneName);
    if (currentScene.showCircles) {
        currentScene.showCircles = false;
        currentScene.hideCircles();
        currentScene.hideLabels()
    } else {
        currentScene.showCircles = true;
        currentScene.drawCircles();    
        currentScene.drawLabels();
    }
}

function toggleShowDirections() {
    var currentScene = game.scene.getScene(phaserSceneName);
    if (currentScene.showArrows) {
        currentScene.showArrows = false;
        currentScene.hideArrows();
    } else {
        currentScene.showArrows = true;
        currentScene.drawArrows();    
    }  
}
