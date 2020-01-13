import Component from '../Component.js';
import { getNagById } from '../services/nagme-api.js';

class NagItem extends Component {

  onRender(dom) {

    const { nag, onRemove } = this.props;
    // removed onUpdate
    // const checkbox = dom.querySelector('.checkbox');
    // checkbox.addEventListener('click', () => {
    //     nag.complete = !nag.complete;
    //     onUpdate(nag);
    // });

    // const nagDetailsButton = dom.querySelector('.details-button');
    // nagDetailsButton.addEventListener('click', () => { const { nag } = this.props;
    //     const json = JSON.stringify(nag, true, 4);
    //     console.log(json);
    //     window.location = `details.html?id=${nag.id}`;
    // });

    const removeSpan = dom.querySelector('.delete-button');
    //const removeNag = document.getElementById('${nag.id}');
    removeSpan.addEventListener('click', () => {
      confirm('Are you sure you want to remove this task?') &&
            onRemove(nag);
        
    });

    const updateButtons = dom.querySelectorAll('.update-button');
    updateButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.props.onAnyClick(nag);
      });
    });
  }

  renderHTML() {
    const nag = this.props.nag;
    let decryptedNag = nag;
    decryptedNag = getNagById(nag.id);
    return /*html*/`
            <li id="${nag.id}">
                <p>
                    <!-- <span class="checkbox"><input type="checkbox" name="checkbox" value="done" ${nag.complete && 'checked'}></span> -->
                    <!-- <span class="task-span${nag.complete && '-strikethrough'}">${decryptedNag.task}</span> -->
                    <span class="task-span">${decryptedNag.task}</span><br class="mobile">
                    <span class="close"><button class="update-button">Edit</button></span><br class="mobile">
                    <span class="close"><button class='delete-button'>Delete</button></span>
                </p>
                <p class="notes-span" hidden>${decryptedNag.notes}</p>
            </li>
        `;
  }
}

export default NagItem;
