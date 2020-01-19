import Component from '../Component.js';
import Header from '../common/Header.js';
import SignUp from './SignUp.js';
import SignIn from './SignIn.js';
import { signUp as userSignUp, signIn as userSignIn } from '../services/nagme-api.js';

function success(user) {
  localStorage.setItem('USER', JSON.stringify(user));
  location = '/list.html';
}

class AuthApp extends Component {

  onRender(dom) {

    const header = new Header();
    dom.prepend(header.renderDOM());

    const errors = dom.querySelector('.errors');
    const signUpContainer = dom.querySelector('#signup-container');
    const signInContainer = dom.querySelector('#signin-container');
    const loginSection = dom.querySelector('.section');
        
    // hide signup and signin if user is logged in
    if(localStorage.getItem('USER')) {
      //signUpContainer.classList.add('hidden');
      //signInContainer.classList.add('hidden');
      loginSection.classList.add('hidden');
    }

    const signUp = new SignUp({
      onSignUp: async newUser => {
        errors.textContent = '';

        try {
          const user = await userSignUp(newUser);
          success(user);
        }
        catch(err) {
          errors.textContent = err;
          throw err;
        }
      }
    });
    signUpContainer.appendChild(signUp.renderDOM());
        
    const signIn = new SignIn({
      onSignIn: async credentials => {
        errors.textContent = '';

        try {
          const user = await userSignIn(credentials);
          success(user);
        }
        catch(err) {
          errors.textContent = err;
          throw err;
        }
      }
    });
    signInContainer.appendChild(signIn.renderDOM());

    const switchToSignIn = dom.querySelector('#signin-button');
    switchToSignIn.addEventListener('click', () => {
      signInContainer.classList.remove('no-display');
      signUpContainer.classList.add('no-display');
    });
        
    const switchToSignUp = dom.querySelector('#signup-button');
    switchToSignUp.addEventListener('click', () => {
      signUpContainer.classList.remove('no-display');
      signInContainer.classList.add('no-display');
    });
  }

  renderHTML() {
    return /*html*/`
            <div class="wrapper">
                <div>
                    <!-- header goes here -->
                    <main class="content">
                    <div class="section">
                        <p class="errors"></p>
                        <section id="signup-container"
                            class="no-display">
                            <p class="switch">
                                <button id="signin-button">Already a User?</button>
                            </p>
                        </section>
                        <section id="signin-container">
                            <p class="switch">
                                <button id="signup-button">Need to create an Account?</button>
                            </p>
                        </section>
                        </div>
                    </main class="content">
                </div>
            </div>
        `;
  }
}

export default AuthApp;
