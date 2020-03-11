import Component from '../Component.js';
import { getNagById } from '../services/nagme-api.js';

class NagItem extends Component {

  onRender(dom) {

    const { nag, onRemove, onAdd, onAnyClick } = this.props;

    const removeSpan = dom.querySelector('.delete-button');
    removeSpan.addEventListener('click', () => {
      confirm('Are you sure you want to remove this task?') && onRemove(nag);
    });

    const duplicateSpan = dom.querySelector('.duplicate-button');
    duplicateSpan.addEventListener('click', () => {
      confirm('Are you sure you want to duplicate this task?') && onAdd(nag);
    });

    const updateButtons = dom.querySelectorAll('.update-button');
    updateButtons.forEach(button => {
      button.addEventListener('click', () => onAnyClick(nag));
    });
  }

  renderHTML() {
    const nag = this.props.nag;

    let decryptedNag = nag;
    (async() => decryptedNag = await getNagById(nag.id))();
    return /*html*/`
            <li id="${nag.id}">
                <p>
                    <!-- <span class="checkbox"><input type="checkbox" name="checkbox" value="done" ${nag.complete && 'checked'}></span> -->
                    <!-- <span class="task-span${nag.complete && '-strikethrough'}">${decryptedNag.task}</span> -->
                    <span class="task-span">${decryptedNag.task}</span><br class="mobile">
                    <span class="close"><button class="update-button">Edit</button></span><br class="mobile">
                    <span class="close"><button class='duplicate-button'>Duplicate</button></span>
                    <span class="close"><button class='delete-button'>Delete</button></span>
                </p>
                <p class="notes-span" hidden>${decryptedNag.notes}</p>
            </li>
        `;
  }
}

export default NagItem;
