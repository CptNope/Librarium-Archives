const PACHISI_P = Object.assign(racePresenter(PACHISI), {
  intro: () => 'You play yellow, from the near arm, and blue, from the far one. Throw to begin.',
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
});
