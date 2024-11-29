// pages/index.js
import './App.scss'; // Import your global styles
import Header from '../features/header/Header'; // Adjust the import path as necessary
import GameList from '../features/game-list/GameList'; // Adjust the import path as necessary
import { Fragment } from 'react';

const Home = () => {
  return (
    <div className="App">
      <Fragment>
        <Header />
        <GameList />
      </Fragment>
    </div>
  );
};

export default Home;