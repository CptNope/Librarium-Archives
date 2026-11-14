const YUT_P = Object.assign(racePresenter(YUT), {
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
});
