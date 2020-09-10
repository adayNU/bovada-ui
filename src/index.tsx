import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

enum BetStatus {
  NotStarted = 0,
  InProgress = 1,
  Won        = 2,
  Lost       = 3,
  Push       = 4,
}

interface Bet {
  id: string,
  // homeTeam represents if the bet is on
  // the home team.
  homeTeam: boolean,
  line: number;
}

interface Parlay {
  id: string,
  bets: Array<Bet>,
}

interface State {
  adders: Array<BetAdd>,
  parlays: Array<Parlay>,
  inputValue: string,
  error: string,
}

interface ScoreResp {
  eventId: number,
  latestScore: {home: string, visitor: string},
  eventDescription: string,
  competitors: Array<{name: string, homeOrVisitor: string}>,
  gameStatus: string;
}

interface BetState {
  score: {home: number, away: number},
  status: BetStatus,
  error: string,
  loading: boolean,
  // Maybe don't use these in state, but fine for now.
  matchup: string,
  betTeamName: string,
}

interface BetAdd {
  text: string,
  home: boolean,
  line: string,
  id: string,
  handleText: Function,
  handleCheck: Function,
  handleLine: Function,
}

class BetHolder extends React.Component<{id: string, homeTeam: boolean, line: number}, BetState> {
  timerID: NodeJS.Timer | null;

  constructor(props: {id: string, homeTeam: boolean, line: number}) {
    super(props);
    this.state = {
      score: {home: 0, away: 0},
      status: BetStatus.NotStarted,
      error: '',
      matchup: '',
      betTeamName: '',
      loading: true,
    }
    this.timerID = null
  }

  componentDidMount() {
    this.updateScores();

    this.timerID = setInterval(
      () => this.updateScores(),
      60000
    )
  }

  componentWillUnmount() {
    if (this.timerID as NodeJS.Timer) {
      clearInterval(this.timerID as NodeJS.Timer);  
    }
  }

  updateScores() {
    if (this.state.status > 1) {
      return;
    }

    fetch("https://services.bovada.lv/services/sports/results/api/v1/scores/" + this.props.id).then(
      (res) => res.json()).then(
        (result) => {
          let resp: ScoreResp = result;
          this.setState({
            score: {home: parseInt(resp.latestScore.home),away: parseInt(resp.latestScore.visitor)},
            status: betState(resp, this.props.homeTeam, this.props.line),
            matchup: resp.eventDescription,
            betTeamName: betTeamNameFromResp(resp, this.props.homeTeam),
            loading: false,
          });
        },
        (error) => {
          this.setState({error: error.toString(), loading: false})
        }
      )
  }

  render() {
    if (this.state.loading) {
      return (
        <tr>
          <td>Loading...</td>
        </tr>
      );
    } else if (this.state.error !== '') {
      return (
        <tr>
          <td>Something went wrong!</td>
        </tr>
      )
    }

    let color;
    let line = this.props.homeTeam ? 1 : -1

    switch (this.state.status) {
      case BetStatus.NotStarted:
        color = 'tied';
        break;
      case BetStatus.Won:
        color = 'won';
        break;
      case BetStatus.Lost:
        color = 'lost';
        break;
      // Need to handle ties.
      default:
        if ((this.state.score.home + (line * this.props.line) > this.state.score.away) && this.props.homeTeam) {
          color = 'winning';
        } else if ((this.state.score.home + (line * this.props.line) < this.state.score.away) && !this.props.homeTeam) {
          color = 'winning';
        } else if (this.state.score.home + (line * this.props.line) === this.state.score.away) {
          color = 'tied';
        } else {
          color = 'losing';
        }
        break;
    }

    return (
      <tr className={color}>
        <td>{this.state.matchup}</td>
        <td>{this.state.betTeamName}</td>
        <td>{this.props.line}</td>
        <td>{this.state.score.home}-{this.state.score.away}</td>
      </tr>
    );
  }
}

function betTeamNameFromResp(resp: ScoreResp, home: boolean) {
  for (let comp of resp.competitors) {
    if (home && comp.homeOrVisitor === 'home') {
      return comp.name;
    } else if (!home && comp.homeOrVisitor === 'visitor') {
      return comp.name;
    }
  }
  return '';
}

function betState(resp: ScoreResp, home: boolean, line: number) {
  let state: BetStatus;
  let ll = home ? 1 : -1

  switch (resp.gameStatus) {
    case 'IN_PROGRESS':
      state = BetStatus.InProgress;
      break;
    case 'PRE_GAME':
      state = BetStatus.NotStarted;
      break;
    case 'GAME_END':
      let homeScore = parseInt(resp.latestScore.home)
      let awayScore = parseInt(resp.latestScore.visitor)
      
      if ((homeScore + (line * ll) > awayScore) && home) {
        state = BetStatus.Won;
      } else if ((homeScore + (line * ll) < awayScore) && !home) {
        state = BetStatus.Won;
      } else if (homeScore + (line * ll) === awayScore) {
        state = BetStatus.Push;
      } else {
        state = BetStatus.Lost;
      }
      break;
    default:
      state = BetStatus.InProgress;
  }
  return state;
}

function ParlayAdderHolder(props: {adders: Array<BetAdd>, handlerAdd: Function, handlerParlay: Function}) {
  let holders = props.adders.map((entry, index) => 
    <ParlayAdder id={index} adder={entry}/>
  )

  return (
    <div>
      <table className="bet">
        <tbody>
          <tr>
            <th>Bet ID</th>
            <th>Home Team?</th>
            <th>Line</th>
          </tr>
          {holders}
        </tbody>
      </table>
      <button className="button" onClick={() => props.handlerAdd()}>Add Bet</button>
      <button className="button" onClick={() => props.handlerParlay()}>Add Parlay</button>
    </div>
  )
}

function ParlayAdder(props: {id: number, adder: BetAdd}) {
  return (
    <tr>
      <td><input type="textbox" value={props.adder.text} onChange={(e) => props.adder.handleText(e, props.id)} /></td>
      <td><input type="checkbox" checked={props.adder.home} onChange={(e) => props.adder.handleCheck(e, props.id)}/></td>
      <td><input type="textbox" value={props.adder.line} onChange={(e) => props.adder.handleLine(e, props.id)}/></td>
    </tr>
  )
}

function ParlayHolder(props: {parlay: Parlay}) {
  let holders = props.parlay.bets.map((entry, index) => 
    <BetHolder id={entry.id} homeTeam={entry.homeTeam} line={entry.line} key={entry.id} />
  )

  return (
    <table className="parlay">
      <tbody>
        <tr>
          <th>Matchup</th>
          <th>Winner Bet</th>
          <th>Line</th>
          <th>Score</th>
        </tr>
        {holders}
      </tbody>
    </table>
  );
}

class Dashboard extends React.Component<object, State> {
  constructor(props: object) {
    super(props);
    this.state = {
      adders: [],
      parlays: [],
      inputValue: '',
      error: '',
    }

    this.handleAdderAdd = this.handleAdderAdd.bind(this)
    this.handleParlayAdd = this.handleParlayAdd.bind(this)
    this.handleTextChange = this.handleTextChange.bind(this)
    this.handleCheckBox = this.handleCheckBox.bind(this)
    this.handleLineChange = this.handleLineChange.bind(this)
  }

  handleTextChange(e: React.ChangeEvent<HTMLInputElement>, id: number) {
    const adders = this.state.adders.slice();
    adders[id].text = e.target.value;
    this.setState({adders: adders});
  }

  handleCheckBox(e: React.ChangeEvent<HTMLInputElement>, id: number) {
    const adders = this.state.adders.slice();
    adders[id].home = e.target.checked;
    this.setState({adders: adders});
  }

  handleLineChange(e: React.ChangeEvent<HTMLInputElement>, id: number) {
    const adders = this.state.adders.slice();
    adders[id].line = e.target.value;
    this.setState({adders: adders})
  }

  handleAdderAdd() {
    const adders = this.state.adders.slice();
    adders[adders.length] = {
      text: "",
      home: false,
      id: adders.length.toString(),
      line: "0",
      handleText:
      this.handleTextChange,
      handleCheck:
      this.handleCheckBox,
      handleLine:
      this.handleLineChange,
    }
    this.setState({adders: adders});
  }

  handleParlayAdd() {
    const parlays = this.state.parlays.slice();
    const bets = this.state.adders.slice();

    let b: Array<Bet> = [];
    for (let bet of bets) {
      b.push({
        id: bet.text,
        homeTeam: bet.home,
        line: parseInt(bet.line),
      })
    }

    this.setState({
      parlays: parlays.concat(
        {
          bets: b,
          id: uuid(),
        }
      ),
      adders: [],
    })
  }

  render() {
    const parlays = this.state.parlays.slice();

    let holders = parlays.map((entry, index) => 
      <ParlayHolder parlay={entry} key={entry.id} />
    )

    return (
      <div>
        {
          <ParlayAdderHolder
            adders={this.state.adders}
            handlerAdd={this.handleAdderAdd}
            handlerParlay={this.handleParlayAdd}
          />
        }  
        {holders}
       </div>
    );
  }
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ========================================

ReactDOM.render(
  <Dashboard />,
  document.getElementById('root')
);
